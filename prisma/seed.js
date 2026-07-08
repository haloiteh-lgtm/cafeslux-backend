const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // ── Admin account — PIN from the original spec (281397) ─────
  const adminPin = process.env.ADMIN_PIN || '281397';
  const pinHash = await bcrypt.hash(adminPin, 10);

  await prisma.employee.upsert({
    where: { id: 'admin-seed' },
    update: {},
    create: { id: 'admin-seed', name: 'Admin', pin: pinHash, role: 'ADMIN', phone: '212677717201' },
  });

  console.log(`✔ Compte Admin créé — PIN: ${adminPin}`);

  // ── Demo categories + products (remplace-les par tes vrais produits) ──
  const boissons = await prisma.category.upsert({
    where: { id: 'cat-boissons' },
    update: {},
    create: { id: 'cat-boissons', name: 'Boissons Chaudes', icon: '☕', position: 1 },
  });

  const patisserie = await prisma.category.upsert({
    where: { id: 'cat-patisserie' },
    update: {},
    create: { id: 'cat-patisserie', name: 'Pâtisserie', icon: '🥐', position: 2 },
  });

  await prisma.product.createMany({
    data: [
      { categoryId: boissons.id, name: 'Café Lux Signature', price: 25, isSignature: true, points: 3 },
      { categoryId: boissons.id, name: 'Cappuccino', price: 20, points: 2 },
      { categoryId: boissons.id, name: 'Thé à la menthe', price: 15, points: 1 },
      { categoryId: patisserie.id, name: 'Croissant', price: 12, points: 1 },
      { categoryId: patisserie.id, name: 'Pain au chocolat', price: 14, points: 1 },
    ],
    skipDuplicates: true,
  });

  console.log('✔ Menu de démonstration créé');
  console.log('\n➡ Connexion Admin / POS / Staff Portal : PIN = ' + adminPin);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
