const router = require('express').Router();
const prisma = require('../utils/prisma');
const { requireAuth } = require('../middleware/auth');

router.post('/', async (req, res) => {
  const { name, phone, date, time, guests, note } = req.body;
  if (!name || !phone || !date || !time) return res.status(400).json({ error: 'Champs requis manquants' });
  const reservation = await prisma.reservation.create({ data: { name, phone, date, time, guests: guests || 2, note } });
  req.app.get('io').emit('reservation:new', reservation);
  res.status(201).json(reservation);
});

router.get('/', requireAuth, async (req, res) => {
  const { date } = req.query;
  const reservations = await prisma.reservation.findMany({
    where: date ? { date } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  res.json(reservations);
});

router.patch('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!['PENDING', 'CONFIRMED', 'CANCELLED'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });
  const reservation = await prisma.reservation.update({ where: { id: req.params.id }, data: { status } });
  req.app.get('io').emit('reservation:update', reservation);
  res.json(reservation);
});

module.exports = router;
