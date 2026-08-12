const router = require('express').Router();
const prisma = require('../utils/prisma');
const {
  optionalAuth,
  requireAuth,
  requireRole
} = require('../middleware/auth');
const { generateCode } = require('../utils/giftcode');


// ============================================================
// CREATE GIFT CARD REQUEST
// Espèces = PENDING
// Aucun code n'est créé avant validation admin.
// ============================================================

router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      amount,
      buyerName,
      buyerPhone,
      recipient,
      recipientName,
      message,
      paymentMethod,
      singleUse
    } = req.body;

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount < 20 ||
      numericAmount > 2000
    ) {
      return res.status(400).json({
        error: 'Montant invalide (20 à 2000 MAD)'
      });
    }

    const customerId =
      req.user?.role === 'CUSTOMER'
        ? req.user.id
        : null;

    // Le frontend utilise "recipient",
    // Prisma utilise "recipientName".
    const finalRecipient =
      recipientName ||
      recipient ||
      null;

    const giftCard = await prisma.giftCard.create({
      data: {
        code: null,

        amount: numericAmount,
        balance: numericAmount,

        singleUse: singleUse !== false,

        // IMPORTANT :
        // La demande reste en attente.
        status: 'PENDING',

        buyerName: buyerName || null,
        buyerPhone: buyerPhone || null,

        recipientName: finalRecipient,

        message: message || null,

        paymentMethod:
          paymentMethod || 'cash',

        customerId
      }
    });

    return res.status(201).json({
      id: giftCard.id,
      amount: giftCard.amount,
      balance: giftCard.balance,
      status: giftCard.status,

      // Aucun code avant validation
      code: null,

      recipient:
        giftCard.recipientName || null,

      message:
        'Demande envoyée. En attente de validation par l’administration.'
    });

  } catch (err) {
    console.error(
      '[CREATE_GIFTCARD]',
      err
    );

    return res.status(500).json({
      error: 'Erreur serveur',
      details: err.message
    });
  }
});


// ============================================================
// ADMIN / MANAGER
// LIST GIFT CARDS
// ============================================================

router.get(
  '/',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    try {
      const cards =
        await prisma.giftCard.findMany({
          orderBy: {
            createdAt: 'desc'
          },

          include: {
            customer: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true
              }
            }
          }
        });

      // Compatibilité avec le frontend :
      // recipientName -> recipient
      return res.json(
        cards.map(card => ({
          ...card,

          recipient:
            card.recipientName || null
        }))
      );

    } catch (err) {
      console.error(
        '[LIST_GIFTCARDS]',
        err
      );

      return res.status(500).json({
        error: 'Erreur serveur',
        details: err.message
      });
    }
  }
);


// ============================================================
// ADMIN / MANAGER
// APPROVE
// ============================================================

router.post(
  '/:id/approve',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    try {
      const giftCard =
        await prisma.giftCard.findUnique({
          where: {
            id: req.params.id
          }
        });

      if (!giftCard) {
        return res.status(404).json({
          error: 'Carte cadeau introuvable'
        });
      }

      if (giftCard.status !== 'PENDING') {
        return res.status(400).json({
          error:
            'Cette demande a déjà été traitée'
        });
      }

      // Générer un code unique
      let code = null;

      for (
        let attempt = 0;
        attempt < 20;
        attempt++
      ) {
        const candidate =
          generateCode();

        const existing =
          await prisma.giftCard.findUnique({
            where: {
              code: candidate
            }
          });

        if (!existing) {
          code = candidate;
          break;
        }
      }

      if (!code) {
        return res.status(500).json({
          error:
            'Impossible de générer le code'
        });
      }

      const updated =
        await prisma.giftCard.update({
          where: {
            id: giftCard.id
          },

          data: {
            code,

            // La carte devient utilisable
            status: 'ACTIVE',

            // Prisma utilise decidedAt
            decidedAt: new Date(),

            decidedBy:
              req.user.id
          }
        });

      return res.json({
        success: true,

        giftCard: {
          ...updated,

          recipient:
            updated.recipientName || null
        }
      });

    } catch (err) {
      console.error(
        '[APPROVE_GIFTCARD]',
        err
      );

      return res.status(500).json({
        error: 'Erreur serveur',
        details: err.message
      });
    }
  }
);


// ============================================================
// ADMIN / MANAGER
// REJECT
// ============================================================

router.post(
  '/:id/reject',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    try {
      const giftCard =
        await prisma.giftCard.findUnique({
          where: {
            id: req.params.id
          }
        });

      if (!giftCard) {
        return res.status(404).json({
          error: 'Carte cadeau introuvable'
        });
      }

      if (giftCard.status !== 'PENDING') {
        return res.status(400).json({
          error:
            'Cette demande a déjà été traitée'
        });
      }

      const updated =
        await prisma.giftCard.update({
          where: {
            id: giftCard.id
          },

          data: {
            code: null,

            status: 'REJECTED',

            // Prisma utilise decidedAt
            decidedAt: new Date(),

            decidedBy:
              req.user.id
          }
        });

      return res.json({
        success: true,

        giftCard: {
          ...updated,

          recipient:
            updated.recipientName || null
        }
      });

    } catch (err) {
      console.error(
        '[REJECT_GIFTCARD]',
        err
      );

      return res.status(500).json({
        error: 'Erreur serveur',
        details: err.message
      });
    }
  }
);


// ============================================================
// CLIENT
// CHECK REQUEST STATUS
// ============================================================

router.get(
  '/status/:id',
  async (req, res) => {
    try {
      const giftCard =
        await prisma.giftCard.findUnique({
          where: {
            id: req.params.id
          }
        });

      if (!giftCard) {
        return res.status(404).json({
          error: 'Demande introuvable'
        });
      }

      return res.json({
        id: giftCard.id,

        status: giftCard.status,

        amount: giftCard.amount,

        recipient:
          giftCard.recipientName || null,

        // Le code est caché tant que
        // l'admin n'a pas accepté.
        code:
          giftCard.status === 'ACTIVE'
            ? giftCard.code
            : null
      });

    } catch (err) {
      console.error(
        '[GIFTCARD_STATUS]',
        err
      );

      return res.status(500).json({
        error: 'Erreur serveur',
        details: err.message
      });
    }
  }
);


// ============================================================
// CHECK GIFT CARD BALANCE
//
// Supporte les DEUX URLs:
//
// /api/giftcards/code/LUX-XXXX
//
// ET
//
// /api/giftcards/LUX-XXXX
//
// Le deuxième est utilisé actuellement
// par le frontend.
// ============================================================

async function checkGiftCardByCode(
  req,
  res
) {
  try {
    const code =
      decodeURIComponent(
        req.params.code || ''
      )
        .trim()
        .toUpperCase();

    if (!code) {
      return res.status(400).json({
        error: 'Code requis'
      });
    }

    const giftCard =
      await prisma.giftCard.findUnique({
        where: {
          code
        }
      });

    if (!giftCard) {
      return res.status(404).json({
        error:
          'Carte cadeau introuvable'
      });
    }

    if (giftCard.status !== 'ACTIVE') {
      return res.status(400).json({
        error:
          'Carte cadeau non active'
      });
    }

    return res.json({
      id: giftCard.id,

      code: giftCard.code,

      amount: giftCard.amount,

      balance: giftCard.balance,

      status: giftCard.status,

      singleUse:
        giftCard.singleUse
    });

  } catch (err) {
    console.error(
      '[CHECK_GIFTCARD]',
      err
    );

    return res.status(500).json({
      error: 'Erreur serveur',
      details: err.message
    });
  }
}


// Ancien endpoint
router.get(
  '/code/:code',
  checkGiftCardByCode
);

// Endpoint utilisé par
// offres / menu / mon-espace
router.get(
  '/:code',
  checkGiftCardByCode
);


// ============================================================
// REDEEM GIFT CARD
//
// Supporte:
//
// /api/giftcards/code/CODE/redeem
//
// ET
//
// /api/giftcards/CODE/redeem
// ============================================================

async function redeemGiftCard(
  req,
  res
) {
  try {
    const code =
      decodeURIComponent(
        req.params.code || ''
      )
        .trim()
        .toUpperCase();

    const amount =
      Number(req.body.amount);

    if (!code) {
      return res.status(400).json({
        error: 'Code requis'
      });
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        error: 'Montant invalide'
      });
    }

    const giftCard =
      await prisma.giftCard.findUnique({
        where: {
          code
        }
      });

    if (!giftCard) {
      return res.status(404).json({
        error:
          'Carte cadeau introuvable'
      });
    }

    if (giftCard.status !== 'ACTIVE') {
      return res.status(400).json({
        error:
          'Carte cadeau non active'
      });
    }

    if (amount > giftCard.balance) {
      return res.status(400).json({
        error: 'Solde insuffisant'
      });
    }

    const newBalance =
      Math.max(
        0,
        giftCard.balance - amount
      );

    const fullyUsed =
      giftCard.singleUse ||
      newBalance <= 0;

    const updated =
      await prisma.giftCard.update({
        where: {
          id: giftCard.id
        },

        data: {
          balance: newBalance,

          status:
            fullyUsed
              ? 'USED'
              : 'ACTIVE',

          usedAt:
            fullyUsed
              ? new Date()
              : null
        }
      });

    return res.json({
      success: true,

      id: updated.id,

      code: updated.code,

      amount: updated.amount,

      balance: updated.balance,

      status: updated.status
    });

  } catch (err) {
    console.error(
      '[REDEEM_GIFTCARD]',
      err
    );

    return res.status(500).json({
      error: 'Erreur serveur',
      details: err.message
    });
  }
}


// Ancien endpoint
router.post(
  '/code/:code/redeem',
  requireAuth,
  redeemGiftCard
);

// Endpoint utilisé par POS / mon-espace
router.post(
  '/:code/redeem',
  requireAuth,
  redeemGiftCard
);


module.exports = router;
