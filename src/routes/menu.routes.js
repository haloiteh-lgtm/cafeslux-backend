const router = require('express').Router();
const prisma = require('../utils/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/menu', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { active: true },
      orderBy: { position: 'asc' },
      include: { products: { where: { active: true } } },
    });
    const menu = categories.map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      items: c.products.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        offerPrice: p.offerPrice,
        imageUrl: p.imageUrl,
        isSignature: p.isSignature,
        active: p.active,
      })),
    }));
    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

router.get('/categories', async (req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { position: 'asc' } });
  res.json(categories);
});

router.post('/categories', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { name, icon, position } = req.body;
  const category = await prisma.category.create({ data: { name, icon, position: position || 0 } });
  res.status(201).json(category);
});

router.patch('/categories/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const category = await prisma.category.update({ where: { id: req.params.id }, data: req.body });
  res.json(category);
});

router.delete('/categories/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  await prisma.category.update({ where: { id: req.params.id }, data: { active: false } });
  res.json({ ok: true });
});

router.get('/offers', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { active: true, offerPrice: { not: null } },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

router.get('/products', async (req, res) => {
  const products = await prisma.product.findMany({ include: { category: true } });
  res.json(products);
});

router.post('/products', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { name, price, categoryId, imageUrl, isSignature, points, stockQty, offerPrice } = req.body;
  if (!name || price == null || !categoryId) return res.status(400).json({ error: 'name, price, categoryId requis' });
  const product = await prisma.product.create({
    data: {
      name, price, categoryId, imageUrl, isSignature: !!isSignature, points: points || 0, stockQty,
      offerPrice: (offerPrice === '' || offerPrice == null) ? null : parseFloat(offerPrice),
    },
  });
  res.status(201).json(product);
});

router.patch('/products/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const data = { ...req.body };
  if ('offerPrice' in data) {
    data.offerPrice = (data.offerPrice === '' || data.offerPrice == null) ? null : parseFloat(data.offerPrice);
  }
  const product = await prisma.product.update({ where: { id: req.params.id }, data });
  res.json(product);
});

router.delete('/products/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  await prisma.product.update({ where: { id: req.params.id }, data: { active: false } });
  res.json({ ok: true });
});

module.exports = router;
