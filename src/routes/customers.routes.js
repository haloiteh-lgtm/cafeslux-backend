const router = require('express').Router();
const prisma = require('../utils/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  POINT_VALUE_DH,
  recordTransaction,
  getWalletSummary,
} = require('../utils/wallet');

const POINTS_TO_DH = POINT_VALUE_DH;

// Garde-fou : ces routes ne doivent servir que le client connecté.
function customerOnly(req, res, next) {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'Accès réservé aux clients' });
  }
  next();
}

// ─────────────────────────────────────────────
// "Mon Espace LUX" — routes self-service
// À déclarer AVANT les routes /:id, sinon Express
// interpréterait "/me" comme un paramètre :id.
// ─────────────────────────────────────────────

router.get('/me', requireAuth, customerOnly, async (req, res) => {
  try {
    // Lecture complète (avec avatarUrl / walletBalance). Si la base n'a pas
    // encore reçu la migration (colonnes manquantes), on se rabat sur une
    // sélection minimale : la connexion ne doit JAMAIS être bloquée par ça.
    let customer;
    try {
      customer = await prisma.customer.findUnique({ where: { id: req.user.id } });
    } catch (e) {
      console.error('[CUSTOMERS_ME] lecture complète échouée, repli minimal:', e.message);
      customer = await prisma.customer.findUnique({
        where: { id: req.user.id },
        select: {
          id: true, name: true, phone: true, email: true,
          pointsTotal: true, pointsUsed: true, createdAt: true,
        },
      });
    }
    if (!customer) return res.status(404).json({ error: 'Compte introuvable' });

    // Statistiques réelles (non bloquantes si elles échouent)
    let ordersCount = 0;
    let totalSpent = 0;
    try {
      const [ordersAgg, count] = await Promise.all([
        prisma.order.aggregate({
          where: { customerId: customer.id, status: { not: 'CANCELLED' } },
          _sum: { total: true },
        }),
        prisma.order.count({
          where: { customerId: customer.id, status: { not: 'CANCELLED' } },
        }),
      ]);
      ordersCount = count;
      totalSpent = Number((ordersAgg._sum.total || 0).toFixed(2));
    } catch (e) {
      console.error('[CUSTOMERS_ME] stats indisponibles:', e.message);
    }

    res.json({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      avatarUrl: customer.avatarUrl || null,

      pointsTotal: customer.pointsTotal,
      pointsUsed: customer.pointsUsed,
      loyaltyPoints: customer.pointsTotal - customer.pointsUsed,

      walletBalance: Number((customer.walletBalance || 0).toFixed(2)),

      ordersCount,
      totalSpent,

      memberSince: customer.createdAt,
      createdAt: customer.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

router.patch('/me', requireAuth, customerOnly, async (req, res) => {
  try {
    const { name, email, avatarUrl } = req.body;
    const data = {};

    if (name !== undefined) {
      const clean = String(name).trim();
      if (!clean) return res.status(400).json({ error: 'Le nom ne peut pas être vide' });
      if (clean.length > 80) return res.status(400).json({ error: 'Nom trop long' });
      data.name = clean;
    }

    if (email !== undefined) {
      const clean = String(email).trim();
      if (clean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
        return res.status(400).json({ error: 'Adresse email invalide' });
      }
      data.email = clean || null;
    }

    if (avatarUrl !== undefined) {
      if (avatarUrl === null || avatarUrl === '') {
        data.avatarUrl = null;
      } else {
        const str = String(avatarUrl);
        const isData = str.startsWith('data:image/');
        const isHttp = /^https?:\/\//i.test(str);
        if (!isData && !isHttp) {
          return res.status(400).json({ error: 'Format de photo non supporté' });
        }
        // ~700 Ko en base64 : la photo doit être redimensionnée côté client
        if (str.length > 950000) {
          return res.status(413).json({ error: 'Photo trop lourde (max ~700 Ko)' });
        }
        data.avatarUrl = str;
      }
    }

    if (!Object.keys(data).length) {
      return res.status(400).json({ error: 'Aucune modification fournie' });
    }

    const customer = await prisma.customer.update({ where: { id: req.user.id }, data });

    res.json({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      avatarUrl: customer.avatarUrl || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// ─────────────────────────────────────────────
// WALLET — résumé du solde et des points
// ─────────────────────────────────────────────
router.get('/me/wallet', requireAuth, customerOnly, async (req, res) => {
  try {
    const summary = await getWalletSummary(req.user.id);
    if (!summary) return res.status(404).json({ error: 'Compte introuvable' });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// ─────────────────────────────────────────────
// HISTORIQUE DES TRANSACTIONS
// Un client ne voit QUE ses propres opérations.
// ─────────────────────────────────────────────
router.get('/me/transactions', requireAuth, customerOnly, async (req, res) => {
  try {
    const take = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

    const [rows, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { customerId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: { order: { select: { id: true, total: true, status: true } } },
      }),
      prisma.transaction.count({ where: { customerId: req.user.id } }),
    ]);

    res.json({
      total,
      count: rows.length,
      transactions: rows.map((t) => ({
        id: t.id,
        type: t.type,
        label: t.label,
        amount: t.amount,
        pointsDelta: t.pointsDelta,
        balanceAfter: t.balanceAfter,
        pointsAfter: t.pointsAfter,
        orderId: t.orderId,
        orderTotal: t.order ? t.order.total : null,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// ─────────────────────────────────────────────
// COMMANDES DU CLIENT
// ─────────────────────────────────────────────
router.get('/me/orders', requireAuth, customerOnly, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.user.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    res.json(orders.map((o) => ({
      id: o.id,
      externalId: o.id,
      createdAt: o.createdAt,
      total: o.total,
      status: o.status,
      payMethod: o.payMethod,
      paymentStatus: o.paymentStatus,
      pointsEarned: o.pointsEarned,
      items: JSON.stringify(o.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price }))),
    })));
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// ─────────────────────────────────────────────
// CARTES CADEAU DU CLIENT
// ─────────────────────────────────────────────
router.get('/me/giftcards', requireAuth, customerOnly, async (req, res) => {
  try {
    const cards = await prisma.giftCard.findMany({
      where: { customerId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(cards.map((c) => ({
      id: c.id,
      code: c.code || null,
      amount: c.amount,
      balance: c.balance,
      status: c.status.toLowerCase(),
      expires: c.createdAt,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// ─────────────────────────────────────────────
// TRANSFÉRER UNE CARTE CADEAU VERS LE SOLDE
// ─────────────────────────────────────────────
router.post('/me/wallet/giftcard', requireAuth, customerOnly, async (req, res) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'Code requis' });

    const gc = await prisma.giftCard.findUnique({ where: { code } });
    if (!gc) return res.status(404).json({ error: 'Carte cadeau introuvable' });
    if (gc.status !== 'ACTIVE') return res.status(400).json({ error: 'Carte cadeau non active' });
    if (gc.balance <= 0) return res.status(400).json({ error: 'Carte cadeau vide' });

    const amount = gc.balance;

    await prisma.giftCard.update({
      where: { id: gc.id },
      data: { balance: 0, status: 'USED', usedAt: new Date(), customerId: req.user.id },
    });

    const result = await recordTransaction({
      customerId: req.user.id,
      type: 'GIFTCARD_CREDIT',
      label: `Carte cadeau ${code.slice(0, 4)}••••`,
      amount,
    });

    res.json({
      success: true,
      credited: amount,
      balance: result.balance,
      transaction: result.transaction,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// ─────────────────────────────────────────────
// ÉCHANGER DES POINTS CONTRE DU SOLDE
// ─────────────────────────────────────────────
router.post('/me/points/redeem', requireAuth, customerOnly, async (req, res) => {
  try {
    const points = Math.trunc(Number(req.body.points) || 0);
    if (points <= 0) return res.status(400).json({ error: 'Nombre de points invalide' });

    const customer = await prisma.customer.findUnique({ where: { id: req.user.id } });
    if (!customer) return res.status(404).json({ error: 'Compte introuvable' });

    const available = customer.pointsTotal - customer.pointsUsed;
    if (points > available) return res.status(400).json({ error: 'Points insuffisants' });

    const credit = Number((points * POINTS_TO_DH).toFixed(2));

    const result = await recordTransaction({
      customerId: req.user.id,
      type: 'POINTS_REDEEMED',
      label: `${points} points échangés contre ${credit} DH`,
      amount: credit,
      pointsDelta: -points,
    });

    res.json({
      success: true,
      pointsUsed: points,
      credited: credit,
      balance: result.balance,
      pointsAvailable: result.pointsAfter,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erreur serveur' });
  }
});

// Conservé pour compatibilité avec l'ancien front
router.post('/me/loyalty', requireAuth, customerOnly, async (req, res) => {
  try {
    const delta = Math.trunc(Number(req.body.points) || 0);
    if (delta === 0) return res.status(400).json({ error: 'Aucun point fourni' });

    const result = await recordTransaction({
      customerId: req.user.id,
      type: delta > 0 ? 'POINTS_EARNED' : 'POINTS_REDEEMED',
      label: delta > 0 ? `${delta} points ajoutés` : `${Math.abs(delta)} points utilisés`,
      pointsDelta: delta,
    });

    const loyaltyPoints = result.pointsAfter;
    const level = loyaltyPoints >= 500 ? 'Gold' : loyaltyPoints >= 200 ? 'Silver' : 'Bronze';
    res.json({ loyaltyPoints, level });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────
// ROUTES STAFF / ADMIN
// ─────────────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  const customers = await prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(customers);
});

router.post('/', async (req, res) => {
  const { name, phone, email } = req.body;
  if (!phone) return res.status(400).json({ error: 'Téléphone requis' });
  const customer = await prisma.customer.upsert({
    where: { phone },
    update: { name: name || undefined, email: email || undefined },
    create: { name, phone, email },
  });
  res.json(customer);
});

router.get('/:id', requireAuth, async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: { orders: { orderBy: { createdAt: 'desc' }, take: 20 }, giftCards: true },
  });
  if (!customer) return res.status(404).json({ error: 'Client introuvable' });
  res.json(customer);
});

// Recharge du solde par la caisse
router.post('/:id/wallet/topup', requireAuth, requireRole('ADMIN', 'MANAGER', 'CASHIER'), async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    const result = await recordTransaction({
      customerId: req.params.id,
      type: 'TOPUP',
      label: req.body.label || `Rechargement de ${amount} DH`,
      amount,
      createdBy: req.user.id,
    });

    res.json({ success: true, balance: result.balance, transaction: result.transaction });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erreur serveur' });
  }
});

// Historique d'un client, côté staff
router.get('/:id/transactions', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const rows = await prisma.transaction.findMany({
    where: { customerId: req.params.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(rows);
});

router.get('/:id/loyalty', requireAuth, async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) return res.status(404).json({ error: 'Client introuvable' });
  const available = customer.pointsTotal - customer.pointsUsed;
  res.json({
    pointsTotal: customer.pointsTotal,
    pointsUsed: customer.pointsUsed,
    pointsAvailable: available,
    discountValueDH: Math.floor(available * POINTS_TO_DH),
  });
});

router.post('/:id/loyalty/redeem', requireAuth, async (req, res) => {
  try {
    const points = Math.trunc(Number(req.body.points) || 0);
    if (points <= 0) return res.status(400).json({ error: 'Points insuffisants' });

    const result = await recordTransaction({
      customerId: req.params.id,
      type: 'POINTS_REDEEMED',
      label: `${points} points utilisés en caisse`,
      pointsDelta: -points,
      createdBy: req.user.id,
    });

    res.json({
      discountValueDH: Math.floor(points * POINTS_TO_DH),
      pointsAvailable: result.pointsAfter,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Points insuffisants' });
  }
});

module.exports = router;
