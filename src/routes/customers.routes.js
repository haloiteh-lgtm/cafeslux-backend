const router = require('express').Router();
const prisma = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');

const POINTS_TO_DH = 0.1;

// ─────────────────────────────────────────────
// "Mon Espace LUX" self-service routes (customer's own account)
// Must be declared BEFORE the /:id routes below, or Express would
// match "/me" as an :id param and break these.
// ─────────────────────────────────────────────

router.get('/me', requireAuth, async (req, res) => {
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Accès réservé aux clients' });
  const customer = await prisma.customer.findUnique({ where: { id: req.user.id } });
  if (!customer) return res.status(404).json({ error: 'Compte introuvable' });
  res.json({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    pointsTotal: customer.pointsTotal,
    pointsUsed: customer.pointsUsed,
    loyaltyPoints: customer.pointsTotal - customer.pointsUsed,
  });
});

router.patch('/me', requireAuth, async (req, res) => {
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Accès réservé aux clients' });
  const { name, email } = req.body;
  const customer = await prisma.customer.update({
    where: { id: req.user.id },
    data: { name: name || undefined, email: email || undefined },
  });
  res.json({ id: customer.id, name: customer.name, email: customer.email, phone: customer.phone });
});

router.get('/me/orders', requireAuth, async (req, res) => {
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Accès réservé aux clients' });
  const orders = await prisma.order.findMany({
    where: { customerId: req.user.id },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  res.json(orders.map(o => ({
    id: o.id,
    externalId: o.id,
    createdAt: o.createdAt,
    total: o.total,
    status: o.status,
    items: JSON.stringify(o.items.map(i => ({ name: i.name, qty: i.qty, price: i.price }))),
  })));
});

router.get('/me/giftcards', requireAuth, async (req, res) => {
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Accès réservé aux clients' });
  const cards = await prisma.giftCard.findMany({ where: { customerId: req.user.id } });
  res.json(cards.map(c => ({
    code: c.code,
    balance: c.balance,
    status: c.status.toLowerCase(),
    expires: c.createdAt,
  })));
});

router.post('/me/loyalty', requireAuth, async (req, res) => {
  if (req.user.role !== 'CUSTOMER') return res.status(403).json({ error: 'Accès réservé aux clients' });
  const { points } = req.body;
  const delta = Number(points) || 0;

  const customer = await prisma.customer.findUnique({ where: { id: req.user.id } });
  if (!customer) return res.status(404).json({ error: 'Compte introuvable' });

  let data;
  if (delta >= 0) {
    data = { pointsTotal: { increment: delta } };
  } else {
    const available = customer.pointsTotal - customer.pointsUsed;
    if (Math.abs(delta) > available) return res.status(400).json({ error: 'Points insuffisants' });
    data = { pointsUsed: { increment: Math.abs(delta) } };
  }

  const updated = await prisma.customer.update({ where: { id: req.user.id }, data });
  const loyaltyPoints = updated.pointsTotal - updated.pointsUsed;
  const level = loyaltyPoints >= 500 ? 'Gold' : loyaltyPoints >= 200 ? 'Silver' : 'Bronze';
  res.json({ loyaltyPoints, level });
});

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
