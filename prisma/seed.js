const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // ── Admin account — PIN from the original spec (281397) ─────
  const adminPin = (process.env.ADMIN_PIN || '281397').trim();
  const pinHash = await bcrypt.hash(adminPin, 10);

  await prisma.employee.upsert({
    where: { id: 'admin-seed' },
    update: { pin: pinHash },
    create: { id: 'admin-seed', name: 'Admin', pin: pinHash, role: 'ADMIN', phone: '212677717201' },
  });

  console.log(`✔ Compte Admin créé — PIN: ${adminPin}`);

  // ── Full category list — matches the real "La Commande" customer menu ──
  const categoryList = [
    { id: 'cat-offres',       name: 'Offres',                     icon: '🔥', position: 0 },
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

  // ── Real menu catalog (140 products, real photos) — matches "La Commande" client menu ──
  const realMenuProducts = [
  { id: 'prod-breakfast-classic-breakfast', categoryId: cats['cat-breakfast'].id, name: 'CLASSIC BREAKFAST', price: 22, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770888638984-x1n9ldyn4m-opt70-1772575344726.jpg' },
  { id: 'prod-breakfast-chamali', categoryId: cats['cat-breakfast'].id, name: 'CHAMALI', price: 27, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770847112027-21jfu5rx1sd.jfif' },
  { id: 'prod-breakfast-omelette-au-fromage', categoryId: cats['cat-breakfast'].id, name: 'OMELETTE AU FROMAGE', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770887978257-aeq9a5fhhjf.jpeg' },
  { id: 'prod-breakfast-moroccan-breakfast', categoryId: cats['cat-breakfast'].id, name: 'MOROCCAN BREAKFAST', price: 35, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770846778007-wmlfxigzr4-opt70-1772575347882.jpg', isSignature: true },
  { id: 'prod-breakfast-morning-lux', categoryId: cats['cat-breakfast'].id, name: 'MORNING LUX', price: 35, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770888380982-m8oj0esyf1j-opt70-1772575351822.jpg' },
  { id: 'prod-coffees-espresso', categoryId: cats['cat-coffees'].id, name: 'Espresso', price: 7, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1771536319803-duaurhkr25v.jpg' },
  { id: 'prod-coffees-espresso-emporter', categoryId: cats['cat-coffees'].id, name: 'Espresso emporter', price: 8, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1771536596086-9sq0pmg1ip7-opt70-1772575446976.jpg' },
  { id: 'prod-coffees-espresso-prestige', categoryId: cats['cat-coffees'].id, name: 'Espresso Prestige', price: 9, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1771536448203-4w2646pb85-opt70-1772575456364.jpg' },
  { id: 'prod-coffees-double-espresso', categoryId: cats['cat-coffees'].id, name: 'Double Espresso', price: 14, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1771538188137-azuirm9odb7.jpg' },
  { id: 'prod-coffees-cafe-separe', categoryId: cats['cat-coffees'].id, name: 'Café Séparé', price: 12, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1771538551799-l600que6eh9.jpg' },
  { id: 'prod-coffees-capsule-au-choix', categoryId: cats['cat-coffees'].id, name: 'Capsule au choix', price: 10, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1771537969343-87i87t3q4j3-opt70-1772575496921.jpg' },
  { id: 'prod-coffees-lait-au-chocolat', categoryId: cats['cat-coffees'].id, name: 'Lait au Chocolat', price: 12, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1771538403611-vikq0tlljb.jpg' },
  { id: 'prod-coffees-lait-chaud', categoryId: cats['cat-coffees'].id, name: 'Lait Chaud', price: 9, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1771537952573-ne2f0pbrn5c.jpg' },
  { id: 'prod-coffees-lait-a-la-verveine', categoryId: cats['cat-coffees'].id, name: 'Lait à la Verveine', price: 12, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1771537463009-qtl9i7oofc-opt70-1772575435803.jpg' },
  { id: 'prod-coffees-lait-aromatise', categoryId: cats['cat-coffees'].id, name: 'Lait Aromatisé', price: 10, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1771537556799-imgyk99jp0l-opt70-1772575487214.jpg' },
  { id: 'prod-cremeux-cafe-creme', categoryId: cats['cat-cremeux'].id, name: 'Café Crème', price: 10, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770896902718-47lbzh2tyeh-opt70-1772575386273.jpg' },
  { id: 'prod-cremeux-cappuccino', categoryId: cats['cat-cremeux'].id, name: 'Cappuccino', price: 12, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770898155811-yc6h68d5xm8-opt70-1772575382621.jpg' },
  { id: 'prod-cremeux-cafe-chocolat', categoryId: cats['cat-cremeux'].id, name: 'Café Chocolat', price: 14, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770897741865-8xfy88dazpy-opt70-1772575438682.jpg' },
  { id: 'prod-cremeux-chocolat-fondu', categoryId: cats['cat-cremeux'].id, name: 'Chocolat Fondu', price: 20, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770898538185-wwd1qti1nd-opt70-1772575389141.jpg' },
  { id: 'prod-infusions-the-marocain', categoryId: cats['cat-infusions'].id, name: 'Thé Marocain', price: 9, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770899588458-03z79wz8enmo-opt70-1772575362160.jpg' },
  { id: 'prod-infusions-golden-tea-tisane-verveine-lipton', categoryId: cats['cat-infusions'].id, name: 'Golden Tea (Tisane, Verveine, Lipton)', price: 9, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770900304271-tmniz1zby7-opt70-1772575443397.jpg' },
  { id: 'prod-infusions-the-royal-sellou', categoryId: cats['cat-infusions'].id, name: 'Thé Royal (Sellou)', price: 19, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770902012080-z7e73r2hwj-opt70-1772575392239.jpg' },
  { id: 'prod-infusions-the-royal', categoryId: cats['cat-infusions'].id, name: 'Thé Royal', price: 20, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770901518074-l4xvmew7kq-opt70-1772575449932.jpg' },
  { id: 'prod-jus-banane', categoryId: cats['cat-jus'].id, name: 'Banane', price: 15, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770847736129-7mx866wogtw.jpg' },
  { id: 'prod-jus-pomme', categoryId: cats['cat-jus'].id, name: 'Pomme', price: 15, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770847743571-elcpzvtlxre.jfif' },
  { id: 'prod-jus-orange', categoryId: cats['cat-jus'].id, name: 'Orange', price: 16, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770847841873-dcaa4gd6av5.webp' },
  { id: 'prod-jus-citron', categoryId: cats['cat-jus'].id, name: 'Citron', price: 16, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770847752195-5nt4b0kadvu.jpg' },
  { id: 'prod-jus-fruits-de-saison', categoryId: cats['cat-jus'].id, name: 'Fruits de Saison', price: 18, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770889616096-bpth9781cp.jpg' },
  { id: 'prod-jus-mangue', categoryId: cats['cat-jus'].id, name: 'Mangue', price: 19, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770847850014-hfgg7we1ebd.jfif' },
  { id: 'prod-jus-ananas', categoryId: cats['cat-jus'].id, name: 'Ananas', price: 19, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770847859840-v32wjiawbte-opt70-1772575355463.jpg' },
  { id: 'prod-jus-avocat', categoryId: cats['cat-jus'].id, name: 'Avocat', price: 20, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770847706345-65bdp0si8vm.webp', isSignature: true },
  { id: 'prod-jus-avocat-royal', categoryId: cats['cat-jus'].id, name: 'Avocat Royal', price: 25, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770888930989-u77gnmp34e8.jpg' },
  { id: 'prod-jus-mojito', categoryId: cats['cat-jus'].id, name: 'Mojito', price: 25, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770847975708-rpjfycf48n.jfif' },
  { id: 'prod-jus-panache-lux', categoryId: cats['cat-jus'].id, name: 'Panaché LUX', price: 25, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770889172356-pggbud974kh-opt70-1772575395452.jpg' },
  { id: 'prod-jus-cocktail-royal', categoryId: cats['cat-jus'].id, name: 'Cocktail Royal', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770889228641-52s4y06h0fp-opt70-1772575398206.jpg' },
  { id: 'prod-jus-zaazaa-lux', categoryId: cats['cat-jus'].id, name: 'Zaazaa Lux', price: 35, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770889362799-0pii81d4w7u-opt70-1772575411353.jpg', isSignature: true },
  { id: 'prod-jus-milkshake-classic', categoryId: cats['cat-jus'].id, name: 'Milkshake Classic', price: 35, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770847936452-83lk8kfm02.jfif' },
  { id: 'prod-jus-soda', categoryId: cats['cat-jus'].id, name: 'Soda', price: 12, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770847946562-v4xqnwavd6o-opt70-1772575359242.jpg' },
  { id: 'prod-jus-red-bull', categoryId: cats['cat-jus'].id, name: 'Red Bull', price: 20, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770847900126-339hxk1i6tv-opt70-1772575365222.jpg' },
  { id: 'prod-signature-lux-matcha-bloom', categoryId: cats['cat-signature'].id, name: 'Lux Matcha Bloom', price: 20, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770925577380-nzcnt80jcz-opt70-1772575371390.jpg', isSignature: true },
  { id: 'prod-signature-queen-s-rose-coffee', categoryId: cats['cat-signature'].id, name: 'Queen\'s Rose Coffee', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770925984963-nlvym9u4bm-opt70-1772575207190.jpg', isSignature: true },
  { id: 'prod-crepes-pancakes-nutella', categoryId: cats['cat-crepes'].id, name: 'Pancakes nutella', price: 27, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777279270677-16727fea-2db.jpg' },
  { id: 'prod-crepes-pancakes-nutella-banane', categoryId: cats['cat-crepes'].id, name: 'Pancakes nutella banane', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777279325215-805980cb-316.jpg' },
  { id: 'prod-crepes-pancakes-fruit-tropicaux', categoryId: cats['cat-crepes'].id, name: 'Pancakes fruit tropicaux', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777279459742-0656920e-bd2.jpg' },
  { id: 'prod-crepes-pancakes-pistache', categoryId: cats['cat-crepes'].id, name: 'Pancakes pistache', price: 35, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777279498984-0b0d18a1-aef.jpg' },
  { id: 'prod-crepes-pancakes-oreo', categoryId: cats['cat-crepes'].id, name: 'Pancakes oreo', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777279750656-7d5704cf-a43.jpg' },
  { id: 'prod-crepes-crepes-nutella', categoryId: cats['cat-crepes'].id, name: 'Crêpes Nutella', price: 28, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770927538804-hj05sqeanqo-opt70-1772575401556.jpg' },
  { id: 'prod-crepes-crepes-nutella-banane', categoryId: cats['cat-crepes'].id, name: 'Crêpes nutella-banane', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770927914135-nhr4uauyp2.jpg' },
  { id: 'prod-crepes-crepes-amlou', categoryId: cats['cat-crepes'].id, name: 'Crêpes amlou', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777280826411-5ebeede6-da9.jpg' },
  { id: 'prod-crepes-crepes-oreo', categoryId: cats['cat-crepes'].id, name: 'Crêpes oreo', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777281231570-fe86e112-61c.jpg' },
  { id: 'prod-crepes-crepes-pistache', categoryId: cats['cat-crepes'].id, name: 'Crêpes pistache', price: 35, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777281097498-29d07f70-673.jpg' },
  { id: 'prod-crepes-crepe-au-fromage', categoryId: cats['cat-crepes'].id, name: 'Crêpe au fromage', price: 25, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770928695505-wtt9sw1926l-opt70-1772575419562.jpg' },
  { id: 'prod-crepes-crepes-poulet-champignon', categoryId: cats['cat-crepes'].id, name: 'Crêpes poulet champignon', price: 25, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777281390514-4853822a-5e6.jpg' },
  { id: 'prod-crepes-crepes-viande-hachee', categoryId: cats['cat-crepes'].id, name: 'Crêpes viande hachee', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777281485798-bd5b8a40-963.jpg' },
  { id: 'prod-crepes-crepes-charcuterie', categoryId: cats['cat-crepes'].id, name: 'Crêpes charcuterie', price: 25, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777281586546-3e221ada-9d0.jpg' },
  { id: 'prod-crepes-pack-de-5-crepes-nature', categoryId: cats['cat-crepes'].id, name: 'Pack de 5 crêpes nature', price: 35, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770929081914-j3qjlsmsnb.jpg' },
  { id: 'prod-snacks-lux-power-toast', categoryId: cats['cat-snacks'].id, name: 'LUX Power Toast', price: 25, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770929211115-jzsu9cvtoif-opt70-1772575430545.jpg' },
  { id: 'prod-salades-salade-marocaine', categoryId: cats['cat-salades'].id, name: 'Salade marocaine', price: 17, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777541304401-62ef762f-71f.jpg' },
  { id: 'prod-salades-salade-nicoise', categoryId: cats['cat-salades'].id, name: 'Salade nicoise', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777541473735-2688d95d-9e3.jpg' },
  { id: 'prod-salades-salade-de-fruits-royale', categoryId: cats['cat-salades'].id, name: 'Salade de Fruits Royale', price: 40, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770975643676-wggdw5q0s1o-opt70-1772575460170.jpg' },
  { id: 'prod-salades-salade-crevette-avocat', categoryId: cats['cat-salades'].id, name: 'Salade Crevette avocat', price: 45, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777541685304-565a2421-8b1.jpg' },
  { id: 'prod-salades-salade-fruit-de-mer', categoryId: cats['cat-salades'].id, name: 'Salade fruit de mer', price: 50, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777541718838-47d57f4a-f61.jpg' },
  { id: 'prod-salades-salade-lux', categoryId: cats['cat-salades'].id, name: 'Salade lux', price: 55, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777541789857-27d77291-835.jpg' },
  { id: 'prod-pizzas-pizza-margherita', categoryId: cats['cat-pizzas'].id, name: 'Pizza margherita', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777368595233-cf1ba85e-6e8.jpg' },
  { id: 'prod-pizzas-pizza-vegetariana', categoryId: cats['cat-pizzas'].id, name: 'Pizza vegetariana', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777368653704-644ddc38-b93.jpg' },
  { id: 'prod-pizzas-pizza-thon', categoryId: cats['cat-pizzas'].id, name: 'Pizza Thon', price: 35, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777442327821-02df40b4-4da.jpg' },
  { id: 'prod-pizzas-pizza-4-fromages', categoryId: cats['cat-pizzas'].id, name: 'Pizza 4 fromages', price: 45, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777443810454-55aa072e-3c6.jpg' },
  { id: 'prod-pizzas-pizza-charcuterie', categoryId: cats['cat-pizzas'].id, name: 'Pizza charcuterie', price: 40, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777536283723-0a7cf1f9-6af.jpg' },
  { id: 'prod-pizzas-pizza-poulet', categoryId: cats['cat-pizzas'].id, name: 'Pizza Poulet', price: 45, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777536817816-49310d32-3e3.jpg' },
  { id: 'prod-pizzas-pizza-viande-hachee', categoryId: cats['cat-pizzas'].id, name: 'Pizza viande hachée', price: 45, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777536673958-9d22a390-f44.jpg' },
  { id: 'prod-pizzas-pizza-fruit-de-mer', categoryId: cats['cat-pizzas'].id, name: 'Pizza fruit de mer', price: 55, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777536797108-7ca2ef8a-10b.jpg' },
  { id: 'prod-pizzas-pizza-4-saisons', categoryId: cats['cat-pizzas'].id, name: 'Pizza 4 saisons', price: 45, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777537019099-2fa8ff5b-3a7.jpg' },
  { id: 'prod-burgers-chicken-burger', categoryId: cats['cat-burgers'].id, name: 'Chicken Burger', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777367181198-6e5d7ac7-69f.jpg' },
  { id: 'prod-burgers-cheeseburger', categoryId: cats['cat-burgers'].id, name: 'Cheeseburger', price: 32, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777366765800-b01ae6aa-7ae.jpg' },
  { id: 'prod-burgers-big-cheeseburger', categoryId: cats['cat-burgers'].id, name: 'Big Cheeseburger', price: 35, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777367125385-4f158114-d82.jpg' },
  { id: 'prod-burgers-royal-burger', categoryId: cats['cat-burgers'].id, name: 'Royal burger', price: 40, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777367351429-6595211e-0d7.jpg' },
  { id: 'prod-burgers-tacos-poulet', categoryId: cats['cat-burgers'].id, name: 'Tacos poulet', price: 35, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777367818171-4086061e-6ef.jpg' },
  { id: 'prod-burgers-tacos-viande-hachee', categoryId: cats['cat-burgers'].id, name: 'Tacos Viande Hachée', price: 35, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777368134696-c0ad86ed-c46.jpg' },
  { id: 'prod-burgers-tacos-mixte', categoryId: cats['cat-burgers'].id, name: 'Tacos mixte', price: 40, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777537283387-9634c9ea-0d3.jpg' },
  { id: 'prod-burgers-tacos-nuggets', categoryId: cats['cat-burgers'].id, name: 'Tacos Nuggets', price: 42, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777537513229-561c4d14-8af.jpg' },
  { id: 'prod-burgers-tacos-cordon-bleu', categoryId: cats['cat-burgers'].id, name: 'Tacos cordon bleu', price: 42, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777537666265-246412c8-b47.jpg' },
  { id: 'prod-burgers-tacos-fruit-de-mer', categoryId: cats['cat-burgers'].id, name: 'Tacos fruit de mer', price: 48, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777537783347-252213dc-06d.jpg' },
  { id: 'prod-burgers-panini-thon', categoryId: cats['cat-burgers'].id, name: 'Panini Thon', price: 25, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777538038537-640f4e1f-f48.jpg' },
  { id: 'prod-burgers-panini-au-poulet', categoryId: cats['cat-burgers'].id, name: 'Panini au poulet', price: 28, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777538170324-23f02c17-103.jpg' },
  { id: 'prod-burgers-panini-viande-hache', categoryId: cats['cat-burgers'].id, name: 'Panini viande haché', price: 28, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777538349123-9eb62860-282.jpg' },
  { id: 'prod-burgers-panini-mixte', categoryId: cats['cat-burgers'].id, name: 'Panini Mixte', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777538477453-9f21d98c-1fa.jpg' },
  { id: 'prod-burgers-panini-fruit-de-mer', categoryId: cats['cat-burgers'].id, name: 'Panini fruit de mer', price: 35, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777538686662-1786d1e3-ffb.jpg' },
  { id: 'prod-burgers-sandwich-thon', categoryId: cats['cat-burgers'].id, name: 'Sandwich Thon', price: 20, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777538950582-cb2b883b-09a.jpg' },
  { id: 'prod-burgers-sandwich-pouet', categoryId: cats['cat-burgers'].id, name: 'Sandwich Pouet', price: 25, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777539062572-1ae5fbf4-db4.jpg' },
  { id: 'prod-burgers-sandwich-viande-hachee', categoryId: cats['cat-burgers'].id, name: 'Sandwich Viande hachée', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777539187950-0ae4209d-ba2.jpg' },
  { id: 'prod-burgers-sandwich-mix', categoryId: cats['cat-burgers'].id, name: 'Sandwich mix', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777539339150-f0c7028c-519.jpg' },
  { id: 'prod-grillades-escalope-de-poulet-gratinee', categoryId: cats['cat-grillades'].id, name: 'Escalope de poulet gratinée', price: 50, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777363920859-c22e10e4-26d.jpg' },
  { id: 'prod-grillades-emince-de-poulet', categoryId: cats['cat-grillades'].id, name: 'Emincé de poulet', price: 50, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777364138506-bf38eb3f-6ed.jpg' },
  { id: 'prod-grillades-brochette-dinde', categoryId: cats['cat-grillades'].id, name: 'Brochette dinde', price: 55, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777364238003-eb9bb487-54e.jpg' },
  { id: 'prod-grillades-brochette-mixtes', categoryId: cats['cat-grillades'].id, name: 'Brochette mixtes', price: 70, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777364318237-b964142e-a2b.jpg' },
  { id: 'prod-grillades-cordon-bleu', categoryId: cats['cat-grillades'].id, name: 'Cordon bleu', price: 60, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777364420406-2e1d5baa-f19.jpg' },
  { id: 'prod-grillades-chicken-shawarma', categoryId: cats['cat-grillades'].id, name: 'Chicken shawarma', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777364697314-2e43f8a9-71e.jpg' },
  { id: 'prod-grillades-shawarma-mix', categoryId: cats['cat-grillades'].id, name: 'Shawarma mix', price: 35, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777364789394-c19ca560-469.jpg' },
  { id: 'prod-grillades-shawarma', categoryId: cats['cat-grillades'].id, name: 'Shawarma', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777364948250-0d7881ee-ae8.jpg' },
  { id: 'prod-marocaine-delice-harira', categoryId: cats['cat-marocaine'].id, name: 'Délice Harira', price: 14, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770929862735-qvop6875my.jpg' },
  { id: 'prod-marocaine-pastilla-poulet', categoryId: cats['cat-marocaine'].id, name: 'Pastilla Poulet', price: 30, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777365120844-482ef7b6-788.jpg' },
  { id: 'prod-marocaine-tajine-poulet', categoryId: cats['cat-marocaine'].id, name: 'Tajine Poulet', price: 45, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777365156343-e50109eb-34f.jpg' },
  { id: 'prod-marocaine-tajine-viande-hachee', categoryId: cats['cat-marocaine'].id, name: 'Tajine viande Hachée', price: 45, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777365222259-68a1fd0e-0da.jpg' },
  { id: 'prod-marocaine-tajine-crevette-pil-pil', categoryId: cats['cat-marocaine'].id, name: 'Tajine Crevette Pil Pil', price: 50, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777365312158-237a6af6-990.jpg' },
  { id: 'prod-marocaine-couscous-marocain', categoryId: cats['cat-marocaine'].id, name: 'Couscous marocain', price: 45, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777365353521-48f4d77a-8cc.jpg' },
  { id: 'prod-gratins-gratin-viande-hachee', categoryId: cats['cat-gratins'].id, name: 'Gratin Viande Hachée', price: 32, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777282272115-4d2aad6d-82a.jpg' },
  { id: 'prod-gratins-gratin-de-poulet', categoryId: cats['cat-gratins'].id, name: 'Gratin de poulet', price: 32, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777282041894-2a4af7eb-811.jpg' },
  { id: 'prod-gratins-gratin-charcuterie', categoryId: cats['cat-gratins'].id, name: 'Gratin Charcuterie', price: 32, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777282141728-5f39ae9f-760.jpg' },
  { id: 'prod-gratins-gratin-nugget', categoryId: cats['cat-gratins'].id, name: 'Gratin Nugget', price: 35, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777281958130-a56b30cc-94e.jpg' },
  { id: 'prod-gratins-gratin-fruit-de-mer', categoryId: cats['cat-gratins'].id, name: 'Gratin fruit de mer', price: 45, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777282374140-f6596bf1-50b.jpg' },
  { id: 'prod-gratins-pasticcio-poulet', categoryId: cats['cat-gratins'].id, name: 'Pasticcio poulet', price: 35, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777362669420-fc7fb6f5-814.jpg' },
  { id: 'prod-gratins-pasticcio-charcuterie', categoryId: cats['cat-gratins'].id, name: 'Pasticcio charcuterie', price: 35, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777362816701-95db0215-fdd.jpg' },
  { id: 'prod-gratins-pasticcio-viande-hachee', categoryId: cats['cat-gratins'].id, name: 'Pasticcio viande Hachée', price: 40, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777362897653-12c0b93c-524.jpg' },
  { id: 'prod-gratins-pasticcio-mix', categoryId: cats['cat-gratins'].id, name: 'Pasticcio Mix', price: 40, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777362990274-8daa8aa8-715.jpg' },
  { id: 'prod-gratins-pasticcio-fruit-de-mer', categoryId: cats['cat-gratins'].id, name: 'Pasticcio fruit de mer', price: 45, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777363070147-277cb48b-a2c.jpg' },
  { id: 'prod-gratins-pates-poulet', categoryId: cats['cat-gratins'].id, name: 'Pâtes Poulet', price: 35, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777363237022-2ade623d-a20.jpg' },
  { id: 'prod-gratins-pates-bolognaise', categoryId: cats['cat-gratins'].id, name: 'Pâtes Bolognaise', price: 40, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777363317020-21cde637-9a9.jpg' },
  { id: 'prod-gratins-pate-4-fromages', categoryId: cats['cat-gratins'].id, name: 'Pâte 4 fromages', price: 40, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777363394366-e47c74c7-f76.jpg' },
  { id: 'prod-gratins-pates-carbonara', categoryId: cats['cat-gratins'].id, name: 'Pâtes Carbonara', price: 40, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777363493551-1fe8d7fb-f54.jpg' },
  { id: 'prod-gratins-pates-fruit-de-mer', categoryId: cats['cat-gratins'].id, name: 'Pâtes Fruit de mer', price: 45, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777363595890-c7f1d907-743.jpg' },
  { id: 'prod-patisseries-tranches-patisserie', categoryId: cats['cat-patisseries'].id, name: 'Tranches Pâtisserie', price: 15, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777373238924-b2f168d6-324.jpg' },
  { id: 'prod-patisseries-panna-cota', categoryId: cats['cat-patisseries'].id, name: 'Panna Cota', price: 20, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777372534584-2e72445b-09b.jpg' },
  { id: 'prod-patisseries-tiramisu', categoryId: cats['cat-patisseries'].id, name: 'Tiramisu', price: 20, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777372574173-1dd354d2-04a.jpg' },
  { id: 'prod-patisseries-assiette-de-fruits', categoryId: cats['cat-patisseries'].id, name: 'Assiette de fruits', price: 25, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777372846095-9a9762da-f00.jpg' },
  { id: 'prod-glaces-glaces-vanille', categoryId: cats['cat-glaces'].id, name: 'Glaces Vanille', price: 10, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777371971708-4458f309-bca.jpg' },
  { id: 'prod-glaces-glaces-chocolat', categoryId: cats['cat-glaces'].id, name: 'Glaces Chocolat', price: 10, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777372014913-a3061d0b-4cb.jpg' },
  { id: 'prod-glaces-glaces-caramel', categoryId: cats['cat-glaces'].id, name: 'Glaces Caramel', price: 10, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777372078143-3c020975-bd8.jpg' },
  { id: 'prod-glaces-pistache', categoryId: cats['cat-glaces'].id, name: 'Pistache', price: 10, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777372132688-fl6gy7dgaaq.jpg' },
  { id: 'prod-glaces-glaces-fraise', categoryId: cats['cat-glaces'].id, name: 'Glaces Fraise', price: 10, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777372204702-0448c595-1fd.jpg' },
  { id: 'prod-glaces-glaces-nougat', categoryId: cats['cat-glaces'].id, name: 'Glaces Nougat', price: 10, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777372267608-afb00bfb-080.jpg' },
  { id: 'prod-glaces-coup-de-glace-lux', categoryId: cats['cat-glaces'].id, name: 'Coup de glace Lux', price: 35, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/products/1777372364784-1f7c3cf5-c76.jpg' },
  { id: 'prod-marocfood-sables-7-pcs', categoryId: cats['cat-marocfood'].id, name: 'Sablés (7 pcs)', price: 13, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770931480339-p0nrxwlck9j-opt70-1772575335418.jpg' },
  { id: 'prod-marocfood-meskouta-traditionnelle', categoryId: cats['cat-marocfood'].id, name: 'Meskouta Traditionnelle', price: 5, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770930340913-y477x1w0hw-opt70-1772575408206.jpg' },
  { id: 'prod-marocfood-cake-prestige', categoryId: cats['cat-marocfood'].id, name: 'Cake Prestige', price: 10, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770930405469-n4h24hn0sag.jpg' },
  { id: 'prod-marocfood-sellou-sfouf-100g', categoryId: cats['cat-marocfood'].id, name: 'Sellou (Sfouf) - 100g', price: 10, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770974025982-5gjtj1wotmt-opt70-1772575452840.jpg' },
  { id: 'prod-marocfood-sellou-sfouf-150g', categoryId: cats['cat-marocfood'].id, name: 'Sellou (Sfouf) - 150g', price: 15, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770973999891-mp123g02fsa-opt70-1772575426243.jpg' },
  { id: 'prod-marocfood-sellou-sfouf-500g', categoryId: cats['cat-marocfood'].id, name: 'Sellou (Sfouf) - 500g', price: 50, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770931879322-9sq09mnn1oo.jpg' },
  { id: 'prod-marocfood-sellou-sfouf-1-kg', categoryId: cats['cat-marocfood'].id, name: 'Sellou (Sfouf) - 1 Kg', price: 100, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770932166373-obe77aa0cp.jpg' },
  { id: 'prod-marocfood-plateau-de-gateaux-marocains', categoryId: cats['cat-marocfood'].id, name: 'Plateau de Gâteaux Marocains', price: 100, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770974112949-f5017iadb0o-opt70-1772575490723.jpg' },
  { id: 'prod-ftour-ftour-ramadan-classique', categoryId: cats['cat-ftour'].id, name: 'FTour Ramadan Classique', price: 40, imageUrl: 'https://izcwecszmdqcsphmuypg.supabase.co/storage/v1/object/public/basico/uploads/1770977039576-53ygvriylx3-opt70-1772575464943.jpg' },
];

  for (const p of realMenuProducts) {
    await prisma.product.upsert({ where: { id: p.id }, update: {}, create: p });
  }

  console.log(`✔ ${realMenuProducts.length} produits réels créés (catalogue complet avec photos)`);

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
