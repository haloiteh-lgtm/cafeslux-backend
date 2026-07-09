const router = require('express').Router();
const prisma = require('../utils/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfWeek(d = new Date()) { const x = startOfDay(d); const day = x.getDay() || 7; x.setDate(x.getDate() - day + 1); return x; }
function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }

async function salesSince(since) {
  const agg = await prisma.order.aggregate({
    where: { createdAt: { gte: since }, status: { not: 'CANCELLED' } },
    _sum: { total: true },
    _count: true,
  });
  return { total: agg._sum.total || 0, count: agg._count || 0 };
}

router.get('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const now = new Date();

    const [today, week, month, allTime] = await Promise.all([
      salesSince(startOfDay(now)),
      salesSince(startOfWeek(now)),
      salesSince(startOfMonth(now)),
      salesSince(new Date(0)),
    ]);

    const [pendingCount, completedCount, expensesAgg, payrollAgg, employees, customersCount, giftCardsAgg] = await Promise.all([
      prisma.order.count({ where: { status: { in: ['PENDING', 'APPROVED', 'PREPARING', 'READY'] } } }),
      prisma.order.count({ where: { status: 'COMPLETED' } }),
      prisma.expense.aggregate({ _sum: { amount: true } }),
      prisma.payrollEntry.aggregate({ _sum: { amount: true }, where: { paid: true } }),
      prisma.employee.findMany({ where: { active: true }, select: { id: true, name: true, salary: true } }),
      prisma.customer.count(),
      prisma.giftCard.aggregate({ _sum: { balance: true }, where: { status: 'ACTIVE' } }),
    ]);

    const topItemsRaw = await prisma.orderItem.groupBy({
      by: ['name'],
      _sum: { qty: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: 10,
    });

    const totalSalaries = employees.reduce((s, e) => s + (e.salary || 0), 0);
    const totalPaid = payrollAgg._sum.amount || 0;

    const expenses = expensesAgg._sum.amount || 0;
    const revenue = allTime.total;
    const profit = revenue - expenses - totalPaid;

    const [pointsAgg] = await Promise.all([
      prisma.customer.aggregate({ _sum: { pointsTotal: true, pointsUsed: true } }),
    ]);

    res.json({
      sales: { today: today.total, week: week.total, month: month.total, allTime: revenue },
      orders: {
        today: today.count,
        pending: pendingCount,
        completed: completedCount,
      },
      finance: {
        revenue,
        expenses,
        salariesTotal: totalSalaries,
        salariesPaid: totalPaid,
        salariesDue: Math.max(totalSalaries - totalPaid, 0),
        profit,
      },
      topProducts: topItemsRaw.map(t => ({ name: t.name, qty: t._sum.qty })),
      customers: { total: customersCount },
      loyalty: {
        pointsIssued: pointsAgg._sum.pointsTotal || 0,
        pointsRedeemed: pointsAgg._sum.pointsUsed || 0,
      },
      giftCards: { activeBalance: giftCardsAgg._sum.balance || 0 },
      employees: employees.map(e => ({ id: e.id, name: e.name, salary: e.salary })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

router.post('/expenses', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { label, amount, category } = req.body;
  if (!label || !amount) return res.status(400).json({ error: 'label et amount requis' });
  const expense = await prisma.expense.create({ data: { label, amount, category } });
  res.status(201).json(expense);
});

router.get('/expenses', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const expenses = await prisma.expense.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(expenses);
});

module.exports = router;
