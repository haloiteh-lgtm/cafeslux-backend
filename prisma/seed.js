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

  const demoProducts = [
    { id: 'prod-cafe-signature', categoryId: boissons.id, name: 'Café Lux Signature', price: 25, isSignature: true, points: 3 },
    { id: 'prod-cappuccino', categoryId: boissons.id, name: 'Cappuccino', price: 20, points: 2 },
    { id: 'prod-the-menthe', categoryId: boissons.id, name: 'Thé à la menthe', price: 15, points: 1 },
    { id: 'prod-croissant', categoryId: patisserie.id, name: 'Croissant', price: 12, points: 1 },
    { id: 'prod-pain-choco', categoryId: patisserie.id, name: 'Pain au chocolat', price: 14, points: 1 },
  ];
  for (const p of demoProducts) {
    await prisma.product.upsert({ where: { id: p.id }, update: {}, create: p });
  }

  console.log('✔ Menu de démonstration créé');

  // ── Gaming Zone stations ──────────────────────────────
  const stations = [
    { id: 'stn-snooker-1', label: 'Snooker', type: 'SNOOKER' },
    { id: 'stn-billard-1', label: 'Billard 1', type: 'BILLARD' },
    { id: 'stn-billard-2', label: 'Billard 2', type: 'BILLARD' },
    { id: 'stn-billard-3', label: 'Billard 3', type: 'BILLARD' },
    { id: 'stn-ps5-1',     label: 'PS5', type: 'PS5' },
    { id: 'stn-ps4-1',     label: 'PS4', type: 'PS4' },
  ];
  for (const s of stations) {
    await prisma.gamingStation.upsert({ where: { id: s.id }, update: {}, create: s });
  }
  console.log('✔ Gaming Zone: 6 stations créées (1 Snooker, 3 Billard, 1 PS5, 1 PS4)');

  console.log('\n➡ Connexion Admin / POS / Staff Portal : PIN = ' + adminPin);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
