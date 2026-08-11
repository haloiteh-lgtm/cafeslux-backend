const router = require('express').Router();
const prisma = require('../utils/prisma');
const {
  optionalAuth,
  requireAuth
} = require('../middleware/auth');
const { generateCode } = require('../utils/giftcode');

// ============================================================
// CREATE GIFT CARD REQUEST
// الكود لا يتم إنشاؤه هنا.
// يتم إنشاء الطلب بحالة PENDING فقط.
// ============================================================

router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      amount,
      buyerName,
      buyerPhone,
      recipient,
      message,
      paymentMethod,
      singleUse
    } = req.body;

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        error: 'Montant invalide'
      });
    }

    let customerId = null;

    if (req.user && req.user.role === 'CUSTOMER') {
      customerId = req.user.id;
    }

    const giftCard = await prisma.giftCard.create({
      data: {
        code: null,
        amount: numericAmount,
        balance: numericAmount,
        singleUse: singleUse !== false,

        status: 'PENDING',

        buyerName: buyerName || null,
        buyerPhone: buyerPhone || null,
        recipient: recipient || null,
        message: message || null,
        paymentMethod: paymentMethod || 'cash',

        customerId
      }
    });

    return res.status(201).json({
      id: giftCard.id,
      amount: giftCard.amount,
      balance: giftCard.balance,
      status: giftCard.status,
      code: null,
      message:
        'Demande envoyée. En attente de validation par l’administration.'
    });

  } catch (err) {
    console.error('[CREATE_GIFTCARD]', err);

    return res.status(500).json({
      error: 'Erreur serveur',
      details: err.message
    });
  }
});


// ============================================================
// ADMIN - LIST GIFT CARDS
// ============================================================

router.get('/', requireAuth, async (req, res) => {
  try {
    const cards = await prisma.giftCard.findMany({
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

    return res.json(cards);

  } catch (err) {
    console.error('[LIST_GIFTCARDS]', err);

    return res.status(500).json({
      error: 'Erreur serveur'
    });
  }
});


// ============================================================
// ADMIN - APPROVE
// هنا فقط يتم إنشاء الكود
// ============================================================

router.post('/:id/approve', requireAuth, async (req, res) => {
  try {
    const giftCard = await prisma.giftCard.findUnique({
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
        error: 'Cette demande a déjà été traitée'
      });
    }

    let code = null;
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 10) {
      code = generateCode();

      const existing = await prisma.giftCard.findUnique({
        where: {
          code
        }
      });

      exists = !!existing;
      attempts++;
    }

    if (exists || !code) {
      return res.status(500).json({
        error: 'Impossible de générer le code'
      });
    }

    const updated = await prisma.giftCard.update({
      where: {
        id: giftCard.id
      },
      data: {
        code,
        status: 'ACTIVE',
        approvedAt: new Date()
      }
    });

    return res.json({
      success: true,
      giftCard: updated
    });

  } catch (err) {
    console.error('[APPROVE_GIFTCARD]', err);

    return res.status(500).json({
      error: 'Erreur serveur',
      details: err.message
    });
  }
});


// ============================================================
// ADMIN - REJECT
// ============================================================

router.post('/:id/reject', requireAuth, async (req, res) => {
  try {
    const giftCard = await prisma.giftCard.findUnique({
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
        error: 'Cette demande a déjà été traitée'
      });
    }

    const updated = await prisma.giftCard.update({
      where: {
        id: giftCard.id
      },
      data: {
        code: null,
        status: 'REJECTED',
        rejectedAt: new Date()
      }
    });

    return res.json({
      success: true,
      giftCard: updated
    });

  } catch (err) {
    console.error('[REJECT_GIFTCARD]', err);

    return res.status(500).json({
      error: 'Erreur serveur',
      details: err.message
    });
  }
});


// ============================================================
// CHECK GIFT CARD
// ============================================================

router.get('/code/:code', async (req, res) => {
  try {
    const code = req.params.code
      .trim()
      .toUpperCase();

    const giftCard = await prisma.giftCard.findUnique({
      where: {
        code
      }
    });

    if (!giftCard) {
      return res.status(404).json({
        error: 'Carte cadeau introuvable'
      });
    }

    if (giftCard.status !== 'ACTIVE') {
      return res.status(400).json({
        error: 'Carte cadeau non active'
      });
    }

    return res.json({
      code: giftCard.code,
      amount: giftCard.amount,
      balance: giftCard.balance,
      status: giftCard.status,
      singleUse: giftCard.singleUse
    });

  } catch (err) {
    console.error('[CHECK_GIFTCARD]', err);

    return res.status(500).json({
      error: 'Erreur serveur'
    });
  }
});


// ============================================================
// REDEEM GIFT CARD
// ============================================================

router.post('/code/:code/redeem', requireAuth, async (req, res) => {
  try {
    const code = req.params.code
      .trim()
      .toUpperCase();

    const amount = Number(req.body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        error: 'Montant invalide'
      });
    }

    const giftCard = await prisma.giftCard.findUnique({
      where: {
        code
      }
    });

    if (!giftCard) {
      return res.status(404).json({
        error: 'Carte cadeau introuvable'
      });
    }

    if (giftCard.status !== 'ACTIVE') {
      return res.status(400).json({
        error: 'Carte cadeau non active'
      });
    }

    if (amount > giftCard.balance) {
      return res.status(400).json({
        error: 'Solde insuffisant'
      });
    }

    const newBalance = giftCard.balance - amount;

    const updated = await prisma.giftCard.update({
      where: {
        code
      },
      data: {
        balance: newBalance,

        status:
          giftCard.singleUse || newBalance <= 0
            ? 'USED'
            : 'ACTIVE',

        usedAt:
          giftCard.singleUse || newBalance <= 0
            ? new Date()
            : null
      }
    });

    return res.json(updated);

  } catch (err) {
    console.error('[REDEEM_GIFTCARD]', err);

    return res.status(500).json({
      error: 'Erreur serveur',
      details: err.message
    });
  }
});


module.exports = router;
