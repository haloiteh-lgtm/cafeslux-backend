const router = require('express').Router();
const prisma = require('../utils/prisma');
const { optionalAuth, requireAuth, requireRole } = require('../middleware/auth');
const { pointsForAmount, recordTransaction } = require('../utils/wallet');

// ─────────────────────────────────────────────────────────────
// Modes de paiement acceptés
//   cash      → Espèces      : ATTEND la validation d'un admin
//   tpe/card  → Carte Bancaire : validé immédiatement
//   paypal    → PayPal         : validé immédiatement
//   gift_card → Carte Cadeau LUX : validé immédiatement
//   wallet    → Solde LUX        : débité immédiatement
// ─────────────────────────────────────────────────────────────
const PAY_METHODS = ['cash', 'tpe', 'card', 'paypal', 'gift_card', 'wallet'];

router.post('/', optionalAuth, async (req, res) => {
  try {
    const { items, customer, customerPhone, customerName, payMethod, source, giftCardCode } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Aucun article dans la commande' });

    // ── Validation du mode de paiement ──────────────────
    const method = String(payMethod || 'cash').toLowerCase();
    if (!PAY_METHODS.includes(method)) {
      return res.status(400).json({ error: 'Mode de paiement invalide' });
    }
    // Espèces => la commande attend la validation d'un admin
    const isCash = method === 'cash';

    const total = items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);

    let customerRecord = null;
    const phone = customerPhone || (typeof customer === 'object' ? customer?.phone : null);
    const name = customerName || (typeof customer === 'object' ? customer?.name : (typeof customer === 'string' ? customer : null));

    // Un client connecté est identifié par son token, jamais par le body
    if (req.user && req.user.role === 'CUSTOMER') {
      customerRecord = await prisma.customer.findUnique({ where: { id: req.user.id } });
    }
    if (!customerRecord && phone) {
      customerRecord = await prisma.customer.upsert({
        where: { phone },
        update: { name: name || undefined },
        create: { phone, name },
      });
    }

    // ── Paiement par solde LUX ──────────────────────────
    if (method === 'wallet') {
      if (!customerRecord) {
        return res.status(401).json({ error: 'Connectez-vous pour payer avec votre solde LUX' });
      }
      if ((customerRecord.walletBalance || 0) < total) {
        return res.status(400).json({
          error: `Solde insuffisant (${(customerRecord.walletBalance || 0).toFixed(2)} DH disponible pour ${total.toFixed(2)} DH)`,
          balance: customerRecord.walletBalance || 0,
          total,
        });
      }
    }

    let giftCardUsed = null;
    let remainingTotal = total;
    if (giftCardCode) {
      const gc = await prisma.giftCard.findUnique({ where: { code: giftCardCode } });
      if (!gc || gc.status !== 'ACTIVE') return res.status(400).json({ error: 'Carte cadeau invalide ou déjà utilisée' });
      if (gc.balance < total) {
        return res.status(400).json({
          error: `Solde insuffisant sur la carte cadeau (${gc.balance.toFixed(2)} DH disponible pour ${total.toFixed(2)} DH de commande). Choisissez un autre mode de paiement ou réduisez le panier.`,
          balance: gc.balance,
          total,
        });
      }
      const deduction = total;
      remainingTotal = 0;
      const newBalance = gc.balance - deduction;
      await prisma.giftCard.update({
        where: { id: gc.id },
        data: {
          balance: newBalance,
          status: (gc.singleUse || newBalance <= 0) ? 'USED' : 'ACTIVE',
          usedAt: new Date(),
        },
      });
      giftCardUsed = giftCardCode;
    }

    // ── Points : règle officielle 10 DH = 1 point ───────
    const bonusPoints = items.reduce((sum, i) => sum + (i.points || 0) * (i.qty || 1), 0);
    const pointsEarned = customerRecord ? pointsForAmount(remainingTotal, bonusPoints) : 0;

    const order = await prisma.order.create({
      data: {
        source: source || 'menu',
        status: isCash ? 'PENDING' : 'APPROVED',
        total,
        payMethod: method,
        paymentStatus: isCash ? 'awaiting_approval' : 'paid',
        giftCardUsed,
        pointsEarned,
        customerId: customerRecord?.id,
        customerName: name || customerRecord?.name,
        customerPhone: phone || customerRecord?.phone,
        employeeId: req.user && req.user.role !== 'CUSTOMER' ? req.user.id : undefined,
        items: {
          create: items.map(i => ({
            productId: i.id || i.productId || undefined,
            name: i.name,
            price: i.price,
            qty: i.qty || 1,
          })),
        },
      },
      include: { items: true },
    });

    // ── Débit du solde LUX ──────────────────────────────
    if (method === 'wallet' && customerRecord) {
      try {
        await recordTransaction({
          customerId: customerRecord.id,
          type: 'PAYMENT',
          label: `Commande #${order.id.slice(-6).toUpperCase()}`,
          amount: -total,
          orderId: order.id,
        });
      } catch (e) {
        // Le débit a échoué : on annule la commande pour rester cohérent
        await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
        return res.status(400).json({ error: e.message || 'Paiement par solde impossible' });
      }
    }

    // ── Crédit des points (avec ligne d'historique) ─────
    // Pour une commande en espèces, les points sont crédités
    // seulement après validation par l'admin (voir /approve).
    if (customerRecord && pointsEarned > 0 && !isCash) {
      await recordTransaction({
        customerId: customerRecord.id,
        type: 'POINTS_EARNED',
        label: `Points gagnés — commande #${order.id.slice(-6).toUpperCase()}`,
        pointsDelta: pointsEarned,
        orderId: order.id,
      }).catch(() => {});
    }

    for (const i of items) {
      if (i.id) {
        await prisma.product.updateMany({
          where: { id: i.id, stockQty: { not: null } },
          data: { stockQty: { decrement: i.qty || 1 } },
        }).catch(() => {});
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('order:new', order);
      // Notification dédiée au Dashboard admin
      if (isCash) io.emit('order:pending-approval', order);
    }

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

const STATUS_MAP = {
  pending: 'PENDING',
  approved: 'APPROVED',
  preparing: 'PREPARING',
  ready: 'READY',
  delivered: 'COMPLETED',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

router.get('/', requireAuth, async (req, res) => {
  const { status, limit, awaiting } = req.query;
  let where;

  // ?awaiting=1 => uniquement les commandes espèces en attente de validation
  if (awaiting === '1' || awaiting === 'true') {
    where = { paymentStatus: 'awaiting_approval' };
  } else if (status === 'all') {
    where = {};
  } else if (status) {
    const mapped = STATUS_MAP[status.toLowerCase()] || status.toUpperCase();
    where = { status: mapped };
  } else {
    where = { status: { notIn: ['COMPLETED', 'CANCELLED'] } };
  }

  const take = Math.min(parseInt(limit, 10) || 200, 500);
  const orders = await prisma.order.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: awaiting ? 'asc' : 'desc' },
    take,
  });
  res.json(orders);
});

// Suivi public : le client garde son écran d'attente ouvert
router.get('/:id/public-status', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      payMethod: true,
      total: true,
      createdAt: true,
    },
  });
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  res.json(order);
});

router.get('/:id', requireAuth, async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  res.json(order);
});

// L'admin valide un paiement en espèces
router.post('/:id/approve', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Commande introuvable' });
    if (existing.paymentStatus !== 'awaiting_approval') {
      return res.status(400).json({ error: 'Cette commande a déjà été traitée' });
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status: 'APPROVED',
        paymentStatus: 'paid',
        approvedBy: req.user.id,
        approvedAt: new Date(),
      },
      include: { items: true },
    });

    // Les points ne sont crédités qu'une fois le paiement validé
    if (order.customerId && order.pointsEarned > 0) {
      await recordTransaction({
        customerId: order.customerId,
        type: 'POINTS_EARNED',
        label: `Points gagnés — commande #${order.id.slice(-6).toUpperCase()}`,
        pointsDelta: order.pointsEarned,
        orderId: order.id,
        createdBy: req.user.id,
      }).catch(() => {});
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('order:approved', order);
      io.emit('order:update', order);
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// L'admin refuse un paiement en espèces
router.post('/:id/reject', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Commande introuvable' });
    if (existing.paymentStatus !== 'awaiting_approval') {
      return res.status(400).json({ error: 'Cette commande a déjà été traitée' });
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'rejected',
        approvedBy: req.user.id,
        approvedAt: new Date(),
      },
      include: { items: true },
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('order:rejected', order);
      io.emit('order:update', order);
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['PENDING', 'APPROVED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Statut invalide' });

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: { items: true },
    });

    const io = req.app.get('io');
    if (io) io.emit('order:update', order);

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// DELETE /api/orders/:id — cancel/remove an order (used by "X" button in dashboard)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Commande introuvable' });

    // Remboursement du solde si la commande avait été payée par wallet
    if (order.payMethod === 'wallet' && order.customerId && order.paymentStatus === 'paid') {
      await recordTransaction({
        customerId: order.customerId,
        type: 'REFUND',
        label: `Remboursement — commande #${order.id.slice(-6).toUpperCase()}`,
        amount: order.total,
        createdBy: req.user.id,
      }).catch(() => {});
    }

    if (order.giftCardUsed) {
      const gc = await prisma.giftCard.findUnique({ where: { code: order.giftCardUsed } });
      if (gc) {
        await prisma.giftCard.update({
          where: { id: gc.id },
          data: { balance: { increment: order.total }, status: 'ACTIVE' },
        });
      }
    }

    const deletedId = req.params.id;
    await prisma.transaction.updateMany({
      where: { orderId: deletedId },
      data: { orderId: null },
    }).catch(() => {});
    await prisma.order.delete({ where: { id: deletedId } });

    const io = req.app.get('io');
    if (io) io.emit('order:deleted', { id: deletedId });

    res.json({ ok: true, id: deletedId });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;
