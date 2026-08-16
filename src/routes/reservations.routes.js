const router = require('express').Router();
const prisma = require('../utils/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────
// CRÉER UNE RÉSERVATION (public)
// Toute nouvelle réservation part en PENDING : elle doit être
// validée par un admin avant d'être confirmée au client.
// ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, phone, date, time, guests } = req.body;

    // Le frontend envoie "notes", Prisma utilise "note"
    const note = req.body.note || req.body.notes || null;

    if (!name || !String(name).trim())   return res.status(400).json({ error: 'Nom requis' });
    if (!phone || !String(phone).trim()) return res.status(400).json({ error: 'Téléphone requis' });
    if (!date)                           return res.status(400).json({ error: 'Date requise' });
    if (!time)                           return res.status(400).json({ error: 'Horaire requis' });

    const nbGuests = parseInt(guests, 10);
    if (guests != null && (!Number.isFinite(nbGuests) || nbGuests < 1 || nbGuests > 50)) {
      return res.status(400).json({ error: 'Nombre de couverts invalide' });
    }

    // Refuser une réservation dans le passé
    const when = new Date(String(date) + 'T' + String(time));
    if (!isNaN(when.getTime()) && when.getTime() < Date.now() - 60 * 60 * 1000) {
      return res.status(400).json({ error: 'Cette date est déjà passée' });
    }

    const reservation = await prisma.reservation.create({
      data: {
        name: String(name).trim(),
        phone: String(phone).trim(),
        date: String(date),
        time: String(time),
        guests: Number.isFinite(nbGuests) ? nbGuests : 2,
        note,
        status: 'PENDING',
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('reservation:new', reservation);
      io.emit('reservation:pending-approval', reservation);
    }

    res.status(201).json(reservation);
  } catch (err) {
    console.error('[CREATE_RESERVATION]', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// SUIVI PUBLIC — le client garde son écran d'attente ouvert
// ─────────────────────────────────────────────────────────────
router.get('/:id/public-status', async (req, res) => {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true, date: true, time: true, guests: true, name: true, createdAt: true },
    });
    if (!reservation) return res.status(404).json({ error: 'Réservation introuvable' });
    res.json(reservation);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// LISTE (admin)
//   ?awaiting=1  → uniquement les demandes en attente
// ─────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const { date, status, awaiting } = req.query;
    const where = {};

    if (awaiting === '1' || awaiting === 'true') {
      where.status = 'PENDING';
    } else if (status) {
      where.status = String(status).toUpperCase();
    }
    if (date) where.date = date;

    const reservations = await prisma.reservation.findMany({
      where,
      orderBy: { createdAt: (awaiting === '1' || awaiting === 'true') ? 'asc' : 'desc' },
    });
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// L'ADMIN CONFIRME
// ─────────────────────────────────────────────────────────────
router.post('/:id/approve', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const existing = await prisma.reservation.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Réservation introuvable' });
    if (existing.status !== 'PENDING') {
      return res.status(400).json({ error: 'Cette demande a déjà été traitée' });
    }

    const reservation = await prisma.reservation.update({
      where: { id: req.params.id },
      data: { status: 'CONFIRMED' },
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('reservation:approved', reservation);
      io.emit('reservation:update', reservation);
    }

    res.json(reservation);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// L'ADMIN REFUSE
// ─────────────────────────────────────────────────────────────
router.post('/:id/reject', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const existing = await prisma.reservation.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Réservation introuvable' });
    if (existing.status !== 'PENDING') {
      return res.status(400).json({ error: 'Cette demande a déjà été traitée' });
    }

    const reservation = await prisma.reservation.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('reservation:rejected', reservation);
      io.emit('reservation:update', reservation);
    }

    res.json(reservation);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// CHANGEMENT DE STATUT MANUEL (conservé pour le Dashboard)
// ─────────────────────────────────────────────────────────────
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['PENDING', 'CONFIRMED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    const reservation = await prisma.reservation.update({
      where: { id: req.params.id },
      data: { status },
    });

    const io = req.app.get('io');
    if (io) io.emit('reservation:update', reservation);

    res.json(reservation);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;
