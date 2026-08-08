const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // ── Admin account — PIN from the original spec (281397) ─────
  const adminPin = process.env.ADMIN_PIN || '281397';
  const pinHash = await bcrypt.hash(adminPin, 10);

  await prisma.employee.upsert({
    where: { id: 'admin-seed' },
    update: { pin: pinHash },
    create: { id: 'admin-seed', name: 'Admin', pin: pinHash, role: 'ADMIN', phone: '212677717201' },
  });

  console.log(`✔ Compte Admin créé — PIN: ${adminPin}`);

  // ── Full category list — matches the real "La Commande" customer menu ──
  const categoryList = [
    { id: 'cat-breakfast',    name: 'Breakfast',                  icon: '🍳', position: 1 },
    { id: 'cat-coffees',      name: 'Espressos & Laits',           icon: '☕', position: 2 },
    { id: 'cat-cremeux',      name: 'Les Crémeux',                 icon: '🥛', position: 3 },
    { id: 'cat-infusions',    name: 'Infusions & Thés',            icon: '🍵', position: 4 },
    { id: 'cat-jus',          name: 'Jus Purs & Boissons',         icon: '🥤', position: 5 },
    { id: 'cat-signature',    name: 'Signature LUX',               icon: '⭐', position: 6 },
    { id: 'cat-snacks',       name: 'Snacks',                      icon: '🥪', position: 7 },
    { id: 'cat-crepes',       name: 'Crêpes & Pancakes',           icon: '🥞', position: 8 },
    { id: 'cat-salades',      name: 'Salades',                     icon: '🥗', position: 9 },
    { id: 'cat-pizzas',       name: 'Pizzas',                      icon: '🍕', position: 10 },
    { id: 'cat-burgers',      name: 'Burgers, Tacos & Sandwichs',  icon: '🍔', position: 11 },
    { id: 'cat-marocaine',    name: 'Cuisine Marocaine',           icon: '🫕', position: 12 },
    { id: 'cat-grillades',    name: 'Grillades & Shawarma',        icon: '🔥', position: 13 },
    { id: 'cat-gratins',      name: 'Gratins & Pâtes',             icon: '🍝', position: 14 },
    { id: 'cat-patisseries',  name: 'Pâtisseries & Desserts',      icon: '🍮', position: 15 },
    { id: 'cat-glaces',       name: 'Ice Cream & Glaces',          icon: '🍨', position: 16 },
    { id: 'cat-marocfood',    name: 'Pâtisseries Marocaines',      icon: '🍪', position: 17 },
    { id: 'cat-ftour',        name: 'Ftour & Menus Spéciaux',      icon: '🌙', position: 18 },
  ];
  const cats = {};
  for (const c of categoryList) {
    cats[c.id] = await prisma.category.upsert({ where: { id: c.id }, update: {}, create: c });
  }
  console.log(`✔ ${categoryList.length} catégories créées (correspondant au menu client réel)`);

  const boissons = cats['cat-coffees'];
  const patisserie = cats['cat-patisseries'];

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
