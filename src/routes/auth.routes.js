const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { sign, requireAuth } = require('../middleware/auth');

// POST /api/auth/pin  { pin }
// Used by POS Caisse, Lux Admin, Staff Portal.
router.post('/pin', async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: 'Code PIN requis' });
    const cleanPin = String(pin).trim();

    // ── Direct override: bypasses the database entirely ─────────
    // Always works as long as ADMIN_PIN is set correctly in Railway.
    const overridePin = (process.env.ADMIN_PIN || '1234').trim();
    if (cleanPin === overridePin) {
      const token = sign({ id: 'admin-override', role: 'ADMIN', name: 'Admin' });
      return res.json({
        token,
        employee: { id: 'admin-override', name: 'Admin', role: 'ADMIN' },
      });
    }

    const employees = await prisma.employee.findMany({ where: { active: true } });
    let matched = null;
    for (const emp of employees) {
      if (await bcrypt.compare(cleanPin, emp.pin)) { matched = emp; break; }
    }

    if (!matched) return res.status(401).json({ error: 'Code PIN invalide' });

    const token = sign({ id: matched.id, role: matched.role, name: matched.name });
    res.json({
      token,
      employee: { id: matched.id, name: matched.name, role: matched.role },
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// POST /api/auth/login  { phone, password } — for Mon Espace Lux (customer accounts)
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'Téléphone et mot de passe requis' });

    const customer = await prisma.customer.findUnique({ where: { phone } });
    if (!customer || !customer.passwordHash) return res.status(401).json({ error: 'Compte introuvable' });

    const ok = await bcrypt.compare(password, customer.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });

    const token = sign({ id: customer.id, role: 'CUSTOMER', name: customer.name });
    res.json({ token, customer: { id: customer.id, name: customer.name, phone: customer.phone, pointsTotal: customer.pointsTotal, pointsUsed: customer.pointsUsed } });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// POST /api/auth/register — create a customer account
router.post('/register', async (req, res) => {
  try {
    const { name, phone, password, email } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'Téléphone et mot de passe requis' });

    const existing = await prisma.customer.findUnique({ where: { phone } });
    if (existing) return res.status(409).json({ error: 'Ce numéro est déjà utilisé' });

    const passwordHash = await bcrypt.hash(password, 10);
    const customer = await prisma.customer.create({ data: { name, phone, email, passwordHash } });

    const token = sign({ id: customer.id, role: 'CUSTOMER', name: customer.name });
    res.status(201).json({ token, customer: { id: customer.id, name: customer.name, phone: customer.phone } });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  if (req.user.role === 'CUSTOMER') {
    const customer = await prisma.customer.findUnique({ where: { id: req.user.id } });
    if (!customer) return res.status(404).json({ error: 'Introuvable' });
    return res.json({ id: customer.id, name: customer.name, phone: customer.phone, role: 'CUSTOMER', pointsTotal: customer.pointsTotal, pointsUsed: customer.pointsUsed });
  }
  const employee = await prisma.employee.findUnique({ where: { id: req.user.id } });
  if (!employee) return res.status(404).json({ error: 'Introuvable' });
  res.json({ id: employee.id, name: employee.name, role: employee.role });
});

module.exports = router;
