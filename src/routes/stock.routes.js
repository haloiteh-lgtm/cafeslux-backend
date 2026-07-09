const router = require('express').Router();
const prisma = require('../utils/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const products = await prisma.product.findMany({
    where: { stockQty: { not: null } },
    include: { category: { select: { name: true } } },
  });
  res.json(products);
});

router.patch('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { stockQty } = req.body;
  const product = await prisma.product.update({ where: { id: req.params.id }, data: { stockQty } });
  res.json(product);
});

module.exports = router;
