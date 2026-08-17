// ─────────────────────────────────────────────────────────────
//  src/utils/wallet.js
//  Règles métier du portefeuille et des points de fidélité.
//  Toute écriture sur le solde ou les points DOIT passer par ici,
//  afin qu'une ligne d'historique soit systématiquement créée.
// ─────────────────────────────────────────────────────────────
const prisma = require('./prisma');

// Règle officielle LUX : 10 DH dépensés = 1 point
const DH_PER_POINT = 10;

// Valeur d'un point lorsqu'il est échangé
const POINT_VALUE_DH = 0.1;

/**
 * Calcule les points gagnés pour un montant donné.
 * `bonus` = points bonus définis produit par produit (champ Product.points).
 */
function pointsForAmount(amount, bonus = 0) {
  const base = Math.floor((Number(amount) || 0) / DH_PER_POINT);
  return Math.max(0, base + (Number(bonus) || 0));
}

/**
 * Écrit une opération dans l'historique ET met à jour le compte client.
 * Tout est fait dans une transaction SQL : soit tout passe, soit rien.
 *
 *  amount      → montant en DH  (positif = crédit, négatif = débit)
 *  pointsDelta → points         (positif = gagnés, négatif = utilisés)
 */
async function recordTransaction({
  customerId,
  type,
  label,
  amount = 0,
  pointsDelta = 0,
  orderId = null,
  createdBy = null,
}) {
  if (!customerId) return null;

  const amt = Number(amount) || 0;
  const pts = Math.trunc(Number(pointsDelta) || 0);

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new Error('Client introuvable');

    const newBalance = Number((customer.walletBalance + amt).toFixed(2));
    if (newBalance < 0) throw new Error('Solde insuffisant');

    // Les points gagnés augmentent pointsTotal,
    // les points utilisés augmentent pointsUsed.
    const data = { walletBalance: newBalance };
    if (pts > 0) data.pointsTotal = { increment: pts };
    if (pts < 0) {
      const available = customer.pointsTotal - customer.pointsUsed;
      if (Math.abs(pts) > available) throw new Error('Points insuffisants');
      data.pointsUsed = { increment: Math.abs(pts) };
    }

    const updated = await tx.customer.update({ where: { id: customerId }, data });
    const pointsAfter = updated.pointsTotal - updated.pointsUsed;

    const transaction = await tx.transaction.create({
      data: {
        customerId,
        type,
        label,
        amount: amt,
        pointsDelta: pts,
        balanceAfter: newBalance,
        pointsAfter,
        orderId,
        createdBy,
      },
    });

    return { transaction, customer: updated, balance: newBalance, pointsAfter };
  });
}

/** Résumé du portefeuille : soldes, totaux gagnés / dépensés. */
async function getWalletSummary(customerId) {
  const [customer, credits, debits, earned, redeemed, count] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    prisma.transaction.aggregate({
      where: { customerId, amount: { gt: 0 } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { customerId, amount: { lt: 0 } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { customerId, pointsDelta: { gt: 0 } },
      _sum: { pointsDelta: true },
    }),
    prisma.transaction.aggregate({
      where: { customerId, pointsDelta: { lt: 0 } },
      _sum: { pointsDelta: true },
    }),
    prisma.transaction.count({ where: { customerId } }),
  ]);

  if (!customer) return null;

  const pointsAvailable = customer.pointsTotal - customer.pointsUsed;

  return {
    balance: Number((customer.walletBalance || 0).toFixed(2)),
    totalCredited: Number((credits._sum.amount || 0).toFixed(2)),
    totalDebited: Number(Math.abs(debits._sum.amount || 0).toFixed(2)),

    pointsTotal: customer.pointsTotal,
    pointsUsed: customer.pointsUsed,
    pointsAvailable,
    pointsEarnedHistory: earned._sum.pointsDelta || 0,
    pointsRedeemedHistory: Math.abs(redeemed._sum.pointsDelta || 0),

    pointsValueDH: Number((pointsAvailable * POINT_VALUE_DH).toFixed(2)),
    transactionsCount: count,
    rule: `${DH_PER_POINT} DH = 1 point`,
  };
}

module.exports = {
  DH_PER_POINT,
  POINT_VALUE_DH,
  pointsForAmount,
  recordTransaction,
  getWalletSummary,
};
