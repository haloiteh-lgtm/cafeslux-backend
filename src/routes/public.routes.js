const router = require('express').Router();
const prisma = require('../utils/prisma');

router.get('/', async (req, res) => {
  const [ordersCount, avgRating] = await Promise.all([
    prisma.order.count({ where: { status: 'COMPLETED' } }),
    prisma.review.aggregate({ _avg: { rating: true }, _count: true }),
  ]);
  res.json({
    ordersServed: ordersCount,
    averageRating: avgRating._avg.rating ? Number(avgRating._avg.rating.toFixed(1)) : null,
    reviewsCount: avgRating._count,
  });
});

router.get('/reviews', async (req, res) => {
  const reviews = await prisma.review.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  res.json(reviews);
});

router.post('/reviews', async (req, res) => {
  const { name, rating, comment, customerId } = req.body;
  if (!rating) return res.status(400).json({ error: 'Note requise' });
  const review = await prisma.review.create({ data: { name, rating, comment, customerId } });
  res.status(201).json(review);
});

module.exports = router;
