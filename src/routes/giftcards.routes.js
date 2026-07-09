const router = require('express').Router();
const prisma = require('../utils/prisma');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { generateCode } = require('../utils/giftcode');

router.post('/', optionalAuth, async (req, res) => {
  try {
    const { amount, buyerName, buyerPhone, singleUse } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Montant invalide' });

    let code, exists = true, attempts = 0;
    while (exists && attempts < 5) {
      code = generateCode();
      exists = !!(await prisma.giftCard.findUnique({ where: { code } }));
      attempts++;
    }

    let customerId = null;
    if (req.user && req.user.role === 'CUSTOMER') customerId = req.user.id;

    const giftCard = await prisma.giftCard.create({
      data: {
        code,
        amount,
        balance: amount,
        singleUse: singleUse !== false,
        buyerName,
        buyerPhone,
        customerId,
      },
    });

    res.status(201).json(giftCard);
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
