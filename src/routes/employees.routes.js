const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const employees = await prisma.employee.findMany({ where: { active: true } });
  res.json(employees.map(({ pin, ...e }) => e));
});

router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { name, pin, role, phone, salary, cin, startDate } = req.body;
  if (!name || !pin) return res.status(400).json({ error: 'Nom et PIN requis' });
  const pinHash = await bcrypt.hash(String(pin), 10);
  const employee = await prisma.employee.create({
    data: {
      name,
      pin: pinHash,
      role: (role || 'staff').toUpperCase(),
      phone,
      salary,
      cin,
      startDate: startDate ? new Date(startDate) : undefined,
    },
  });
  const { pin: _drop, ...safe } = employee;
  res.status(201).json(safe);
});

router.patch('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const data = { ...req.body };
  if (data.pin) data.pin = await bcrypt.hash(String(data.pin), 10);
  if (data.role) data.role = data.role.toUpperCase();
  if (data.startDate) data.startDate = new Date(data.startDate);
  const employee = await prisma.employee.update({ where: { id: req.params.id }, data });
  const { pin: _drop, ...safe } = employee;
  res.json(safe);
});

router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  await prisma.employee.update({ where: { id: req.params.id }, data: { active: false } });
  res.json({ ok: true });
});

router.post('/:id/attendance', requireAuth, async (req, res) => {
  const { action } = req.body;
  if (action === 'in') {
    const att = await prisma.attendance.create({ data: { employeeId: req.params.id } });
    return res.json(att);
  }
  const open = await prisma.attendance.findFirst({
    where: { employeeId: req.params.id, clockOut: null },
    orderBy: { clockIn: 'desc' },
  });
  if (!open) return res.status(400).json({ error: 'Aucun pointage ouvert' });
  const att = await prisma.attendance.update({ where: { id: open.id }, data: { clockOut: new Date() } });
  res.json(att);
});

router.post('/:id/advances', requireAuth, async (req, res) => {
  const { amount, reason } = req.body;
  if (!amount) return res.status(400).json({ error: 'Montant requis' });
  const request = await prisma.advanceRequest.create({
    data: { employeeId: req.params.id, amount, reason },
  });
  req.app.get('io').emit('advance:new', request);
  res.status(201).json(request);
});

router.get('/:id/advances', requireAuth, async (req, res) => {
  const requests = await prisma.advanceRequest.findMany({
    where: { employeeId: req.params.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
});

router.get('/advances/all', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const requests = await prisma.advanceRequest.findMany({
    include: { employee: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
});

router.patch('/advances/:requestId', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { status } = req.body;
  if (!['APPROVED', 'REFUSED'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });
  const request = await prisma.advanceRequest.update({
    where: { id: req.params.requestId },
    data: { status, respondedAt: new Date() },
  });
  req.app.get('io').emit('advance:update', request);
  res.json(request);
});

router.post('/:id/payroll', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { amount, note } = req.body;
  const entry = await prisma.payrollEntry.create({ data: { employeeId: req.params.id, amount, note } });
  res.status(201).json(entry);
});

router.get('/:id/payroll', requireAuth, async (req, res) => {
  const entries = await prisma.payrollEntry.findMany({ where: { employeeId: req.params.id }, orderBy: { createdAt: 'desc' } });
  res.json(entries);
});

module.exports = router;
