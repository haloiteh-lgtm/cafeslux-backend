const router = require('express').Router();
const prisma = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');

const POINTS_TO_DH = 0.1;

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
  const { points } = req.body;
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) return res.status(404).json({ error: 'Client introuvable' });
  const available = customer.pointsTotal - customer.pointsUsed;
  if (!points || points > available) return res.status(400).json({ error: 'Points insuffisants' });

  const updated = await prisma.customer.update({
    where: { id: req.params.id },
    data: { pointsUsed: { increment: points } },
  });
  res.json({
    discountValueDH: Math.floor(points * POINTS_TO_DH),
    pointsAvailable: updated.pointsTotal - updated.pointsUsed,
  });
});

module.exports = router;
