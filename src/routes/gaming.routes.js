const router = require('express').Router();
const prisma = require('../utils/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

const PRICING = {
  SNOOKER: { mode: 'flat', flatPrice: 20, label: 'Partie' },
  BILLARD: { mode: 'flat', flatPrice: 5, label: 'Partie' },
  PS5: {
    mode: 'tiered',
    tiers: [
      { hours: 0.25, label: '15 minutes', price: 8 },
      { hours: 0.5, label: '30 minutes', price: 15 },
      { hours: 1, label: '1 heure', price: 30 },
    ],
  },
  PS4: {
    mode: 'tiered',
    tiers: [
      { hours: 0.25, label: '15 minutes', price: 5 },
      { hours: 0.5, label: '30 minutes', price: 10 },
      { hours: 1, label: '1 heure', price: 20 },
    ],
  },
};

function computePrice(type, hours) {
  const rule = PRICING[type];
  if (!rule) throw new Error('Type de station inconnu');
  if (rule.mode === 'flat') {
    return { price: rule.flatPrice, label: rule.label, hours: null };
  }
  const tier = rule.tiers.find((t) => t.hours === Number(hours));
  if (!tier) throw new Error('Durée invalide pour ce type de station');
  return { price: tier.price, label: tier.label, hours: tier.hours };
}

function withSession(station) {
  const active = (station.sessions || []).find((s) => s.status === 'ACTIVE');
  return {
    id: station.id,
    label: station.label,
    type: station.type,
    status: station.status.toLowerCase(),
    currentSession: active
      ? {
          id: active.id,
          playerName: active.playerName,
          planLabel: active.planLabel,
          totalPrice: active.totalPrice,
          paymentMethod: active.paymentMethod,
          paymentStatus: active.paymentStatus,
          startedAt: active.startedAt,
          endsAt: active.endsAt,
        }
      : null,
  };
}

router.get('/pricing', (req, res) => {
  res.json(PRICING);
});

router.get('/stations', async (req, res) => {
  try {
    const stations = await prisma.gamingStation.findMany({
      include: { sessions: { where: { status: 'ACTIVE' } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(stations.map(withSession));
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

router.get('/stats', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const [activeSessions, todaySessions] = await Promise.all([
      prisma.gamingSession.count({ where: { status: 'ACTIVE' } }),
      prisma.gamingSession.findMany({ where: { createdAt: { gte: startOfDay } } }),
    ]);
    const revenueToday = todaySessions.reduce((s, x) => s + (x.totalPrice || 0), 0);
    res.json({ activeSessions, revenueToday, sessionsToday: todaySessions.length });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

router.get('/stations/:id', async (req, res) => {
  const station = await prisma.gamingStation.findUnique({
    where: { id: req.params.id },
    include: { sessions: { where: { status: 'ACTIVE' } } },
  });
  if (!station) return res.status(404).json({ error: 'Station introuvable' });
  res.json(withSession(station));
});

router.post('/activate', async (req, res) => {
  try {
    const { stationId, hours, playerName, paymentMethod, paymentStatus } = req.body;
    if (!stationId) return res.status(400).json({ error: 'stationId requis' });

    const station = await prisma.gamingStation.findUnique({
      where: { id: stationId },
      include: { sessions: { where: { status: 'ACTIVE' } } },
    });
    if (!station) return res.status(404).json({ error: 'Station introuvable' });
    if (station.status === 'ACTIVE') return res.status(409).json({ error: 'Station déjà occupée' });

    const { price, label, hours: normHours } = computePrice(station.type, hours);
    const startedAt = new Date();
    const endsAt = normHours ? new Date(startedAt.getTime() + normHours * 3600000) : null;

    const session = await prisma.gamingSession.create({
      data: {
        stationId,
        playerName: playerName || 'Client LUX',
        planLabel: label,
        totalPrice: price,
        paymentMethod: paymentMethod || 'cash',
        paymentStatus: paymentStatus || 'pending',
        startedAt,
        endsAt,
      },
    });
    await prisma.gamingStation.update({ where: { id: stationId }, data: { status: 'ACTIVE' } });

    const io = req.app.get('io');
    if (io) io.emit('station:updated', { stationId, status: 'ACTIVE' });

    res.status(201).json({ ok: true, session });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erreur serveur' });
  }
});

router.post('/stations/:id/confirm', requireAuth, async (req, res) => {
  try {
    const session = await prisma.gamingSession.findFirst({
      where: { stationId: req.params.id, status: 'ACTIVE' },
    });
    if (!session) return res.status(404).json({ error: 'Aucune session active' });
    const updated = await prisma.gamingSession.update({
      where: { id: session.id },
      data: { paymentStatus: 'paid' },
    });
    res.json({ ok: true, session: updated });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

router.post('/stations/:id/deactivate', requireAuth, async (req, res) => {
  try {
    const session = await prisma.gamingSession.findFirst({
      where: { stationId: req.params.id, status: 'ACTIVE' },
    });
    if (session) {
      await prisma.gamingSession.update({
        where: { id: session.id },
        data: { status: 'COMPLETED', endedAt: new Date() },
      });
    }
    await prisma.gamingStation.update({ where: { id: req.params.id }, data: { status: 'IDLE' } });

    const io = req.app.get('io');
    if (io) io.emit('station:updated', { stationId: req.params.id, status: 'IDLE' });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

router.post('/verify-payment', async (req, res) => {
  res.json({ verified: true, method: 'cash' });
});

module.exports = router;
