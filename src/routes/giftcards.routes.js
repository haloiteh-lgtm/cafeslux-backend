const router = require('express').Router();
const prisma = require('../utils/prisma');
const { optionalAuth, requireAuth, requireRole } = require('../middleware/auth');
const { generateCode } = require('../utils/giftcode');

router.post('/', optionalAuth, async (req, res) => {
  try {
    const { amount, buyerName, buyerPhone, recipientName, message, singleUse, paymentMethod } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Montant invalide' });

    let customerId = null;
    if (req.user && req.user.role === 'CUSTOMER') customerId = req.user.id;

    // ── Carte Cadeau "Espèce" : demande en attente, AUCUN code tant que
    //    l'admin n'a pas validé depuis le Dashboard ────────────────────
    if (paymentMethod === 'cash') {
      const request = await prisma.giftCard.create({
        data: {
          amount,
          balance: amount,
          singleUse: singleUse !== false,
          buyerName,
          buyerPhone,
          recipientName,
          message,
          paymentMethod: 'cash',
          status: 'PENDING',
          customerId,
        },
      });
      return res.status(201).json({
        id: request.id,
        status: request.status,
        amount: request.amount,
        createdAt: request.createdAt,
      });
    }

    // ── Autres moyens de paiement (déjà réglés via passerelle) ─────────
    let code, exists = true, attempts = 0;
    while (exists && attempts < 5) {
      code = generateCode();
      exists = !!(await prisma.giftCard.findUnique({ where: { code } }));
      attempts++;
    }

    const giftCard = await prisma.giftCard.create({
      data: {
        code,
        amount,
        balance: amount,
        singleUse: singleUse !== false,
        buyerName,
        buyerPhone,
        recipientName,
        message,
        paymentMethod: paymentMethod || 'card',
        status: 'ACTIVE',
        customerId,
      },
    });

    res.status(201).json(giftCard);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// GET /api/giftcards/requests/:id — suivi public d'une demande (pas de code tant que PENDING)
router.get('/requests/:id', async (req, res) => {
  try {
    const gc = await prisma.giftCard.findUnique({ where: { id: req.params.id } });
    if (!gc) return res.status(404).json({ error: 'Demande introuvable' });
    res.json({
      id: gc.id,
      status: gc.status,
      amount: gc.amount,
      code: gc.status === 'ACTIVE' ? gc.code : null,
      createdAt: gc.createdAt,
      decidedAt: gc.decidedAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// PATCH /api/giftcards/:id/approve — Admin/Manager uniquement
router.patch('/:id/approve', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const gc = await prisma.giftCard.findUnique({ where: { id: req.params.id } });
    if (!gc) return res.status(404).json({ error: 'Demande introuvable' });
    if (gc.status !== 'PENDING') return res.status(400).json({ error: 'Cette demande a déjà été traitée' });

    let code, exists = true, attempts = 0;
    while (exists && attempts < 5) {
      code = generateCode();
      exists = !!(await prisma.giftCard.findUnique({ where: { code } }));
      attempts++;
    }

    const updated = await prisma.giftCard.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE', code, decidedAt: new Date(), decidedBy: req.user.id },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// PATCH /api/giftcards/:id/reject — Admin/Manager uniquement
router.patch('/:id/reject', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const gc = await prisma.giftCard.findUnique({ where: { id: req.params.id } });
    if (!gc) return res.status(404).json({ error: 'Demande introuvable' });
    if (gc.status !== 'PENDING') return res.status(400).json({ error: 'Cette demande a déjà été traitée' });

    const updated = await prisma.giftCard.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED', decidedAt: new Date(), decidedBy: req.user.id },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

router.get('/:code', async (req, res) => {
  const gc = await prisma.giftCard.findUnique({ where: { code: req.params.code } });
  if (!gc) return res.status(404).json({ error: 'Carte cadeau introuvable' });
  res.json({ code: gc.code, balance: gc.balance, amount: gc.amount, status: gc.status, singleUse: gc.singleUse });
});

router.post('/:code/redeem', requireAuth, async (req, res) => {
  try {
    const { amount } = req.body;
    const gc = await prisma.giftCard.findUnique({ where: { code: req.params.code } });
    if (!gc) return res.status(404).json({ error: 'Carte cadeau introuvable' });
    if (gc.status !== 'ACTIVE') return res.status(400).json({ error: 'Carte cadeau déjà utilisée ou expirée' });
    if (amount > gc.balance) return res.status(400).json({ error: 'Solde insuffisant' });

    const newBalance = gc.balance - amount;
    const updated = await prisma.giftCard.update({
      where: { code: req.params.code },
      data: {
        balance: newBalance,
        status: (gc.singleUse || newBalance <= 0) ? 'USED' : 'ACTIVE',
        usedAt: new Date(),
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

router.get('/', requireAuth, async (req, res) => {
  const cards = await prisma.giftCard.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(cards);
});

module.exports = router;
