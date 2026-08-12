const router = require('express').Router();
const prisma = require('../utils/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');


// ============================================================
// PUBLIC MENU
// ============================================================

router.get('/menu', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: {
        active: true
      },

      orderBy: {
        position: 'asc'
      },

      include: {
        products: {
          where: {
            active: true
          },

          orderBy: {
            name: 'asc'
          }
        }
      }
    });

    const menu = categories.map(category => ({
      id: category.id,
      name: category.name,
      icon: category.icon,

      items: category.products.map(product => ({
        id: product.id,
        name: product.name,
        price: product.price,
        offerPrice: product.offerPrice,
        imageUrl: product.imageUrl,
        isSignature: product.isSignature,
        active: product.active,
        categoryId: product.categoryId
      }))
    }));

    res.json(menu);

  } catch (err) {
    console.error('[GET_MENU]', err);

    res.status(500).json({
      error: 'Erreur serveur',
      details: err.message
    });
  }
});


// ============================================================
// CATEGORIES
// ============================================================

router.get('/categories', async (req, res) => {
  try {
    const categories =
      await prisma.category.findMany({
        orderBy: {
          position: 'asc'
        },

        include: {
          products: {
            where: {
              active: true
            },

            orderBy: {
              name: 'asc'
            }
          }
        }
      });

    res.json(categories);

  } catch (err) {
    console.error('[GET_CATEGORIES]', err);

    res.status(500).json({
      error: 'Erreur serveur',
      details: err.message
    });
  }
});


// ============================================================
// CREATE CATEGORY
// ============================================================

router.post(
  '/categories',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    try {
      const {
        name,
        icon,
        position
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({
          error: 'Nom de catégorie requis'
        });
      }

      const category =
        await prisma.category.create({
          data: {
            name: name.trim(),

            icon:
              icon || '📂',

            position:
              Number.isFinite(Number(position))
                ? Number(position)
                : 0
          }
        });

      res.status(201).json(category);

    } catch (err) {
      console.error('[CREATE_CATEGORY]', err);

      res.status(500).json({
        error: 'Erreur serveur',
        details: err.message
      });
    }
  }
);


// ============================================================
// UPDATE CATEGORY
// ============================================================

router.patch(
  '/categories/:id',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    try {
      const data = {};

      if (req.body.name !== undefined) {
        data.name =
          String(req.body.name).trim();
      }

      if (req.body.icon !== undefined) {
        data.icon =
          req.body.icon;
      }

      if (req.body.position !== undefined) {
        data.position =
          Number(req.body.position);
      }

      if (req.body.active !== undefined) {
        data.active =
          Boolean(req.body.active);
      }

      const category =
        await prisma.category.update({
          where: {
            id: req.params.id
          },

          data
        });

      res.json(category);

    } catch (err) {
      console.error('[UPDATE_CATEGORY]', err);

      res.status(500).json({
        error: 'Erreur serveur',
        details: err.message
      });
    }
  }
);


// ============================================================
// DELETE CATEGORY
// ============================================================

router.delete(
  '/categories/:id',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    try {
      await prisma.category.update({
        where: {
          id: req.params.id
        },

        data: {
          active: false
        }
      });

      res.json({
        ok: true
      });

    } catch (err) {
      console.error('[DELETE_CATEGORY]', err);

      res.status(500).json({
        error: 'Erreur serveur',
        details: err.message
      });
    }
  }
);


// ============================================================
// OFFERS
// ============================================================

router.get('/offers', async (req, res) => {
  try {
    const products =
      await prisma.product.findMany({
        where: {
          active: true,

          offerPrice: {
            not: null
          }
        },

        include: {
          category: true
        },

        orderBy: {
          name: 'asc'
        }
      });

    res.json(products);

  } catch (err) {
    console.error('[GET_OFFERS]', err);

    res.status(500).json({
      error: 'Erreur serveur',
      details: err.message
    });
  }
});


// ============================================================
// PRODUCTS
// ============================================================

router.get('/products', async (req, res) => {
  try {
    const products =
      await prisma.product.findMany({
        include: {
          category: true
        },

        orderBy: {
          name: 'asc'
        }
      });

    res.json(products);

  } catch (err) {
    console.error('[GET_PRODUCTS]', err);

    res.status(500).json({
      error: 'Erreur serveur',
      details: err.message
    });
  }
});


// ============================================================
// CREATE PRODUCT
// ============================================================

router.post(
  '/products',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    try {
      const {
        name,
        price,
        categoryId,
        imageUrl,
        isSignature,
        points,
        stockQty,
        offerPrice
      } = req.body;

      if (
        !name ||
        price == null ||
        !categoryId
      ) {
        return res.status(400).json({
          error:
            'name, price, categoryId requis'
        });
      }

      const numericPrice =
        parseFloat(price);

      if (
        !Number.isFinite(numericPrice) ||
        numericPrice < 0
      ) {
        return res.status(400).json({
          error: 'Prix invalide'
        });
      }

      let numericOfferPrice = null;

      if (
        offerPrice !== '' &&
        offerPrice != null
      ) {
        numericOfferPrice =
          parseFloat(offerPrice);

        if (
          !Number.isFinite(
            numericOfferPrice
          ) ||
          numericOfferPrice < 0
        ) {
          return res.status(400).json({
            error:
              'Prix Offre invalide'
          });
        }

        if (
          numericOfferPrice >= numericPrice
        ) {
          return res.status(400).json({
            error:
              'Le prix Offre doit être inférieur au prix normal'
          });
        }
      }

      const product =
        await prisma.product.create({
          data: {
            name:
              String(name).trim(),

            price:
              numericPrice,

            categoryId,

            imageUrl:
              imageUrl || null,

            isSignature:
              !!isSignature,

            points:
              Number(points) || 0,

            stockQty:
              stockQty == null ||
              stockQty === ''
                ? null
                : Number(stockQty),

            offerPrice:
              numericOfferPrice
          },

          include: {
            category: true
          }
        });

      res.status(201).json(product);

    } catch (err) {
      console.error(
        '[CREATE_PRODUCT]',
        err
      );

      res.status(500).json({
        error: 'Erreur serveur',
        details: err.message
      });
    }
  }
);


// ============================================================
// UPDATE PRODUCT
// ============================================================

router.patch(
  '/products/:id',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    try {
      const data = {};

      if (req.body.name !== undefined) {
        data.name =
          String(req.body.name).trim();
      }

      if (req.body.price !== undefined) {
        const price =
          parseFloat(req.body.price);

        if (
          !Number.isFinite(price) ||
          price < 0
        ) {
          return res.status(400).json({
            error: 'Prix invalide'
          });
        }

        data.price = price;
      }

      if (
        req.body.categoryId !== undefined
      ) {
        data.categoryId =
          req.body.categoryId;
      }

      if (
        req.body.imageUrl !== undefined
      ) {
        data.imageUrl =
          req.body.imageUrl || null;
      }

      if (
        req.body.isSignature !== undefined
      ) {
        data.isSignature =
          Boolean(req.body.isSignature);
      }

      if (
        req.body.points !== undefined
      ) {
        data.points =
          Number(req.body.points) || 0;
      }

      if (
        req.body.stockQty !== undefined
      ) {
        data.stockQty =
          req.body.stockQty === '' ||
          req.body.stockQty == null
            ? null
            : Number(req.body.stockQty);
      }

      // ======================================================
      // OFFER PRICE
      // ======================================================

      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          'offerPrice'
        )
      ) {
        if (
          req.body.offerPrice === '' ||
          req.body.offerPrice == null
        ) {
          // Retirer le produit des offres
          data.offerPrice = null;

        } else {

          const offerPrice =
            parseFloat(
              req.body.offerPrice
            );

          if (
            !Number.isFinite(
              offerPrice
            ) ||
            offerPrice < 0
          ) {
            return res.status(400).json({
              error:
                'Prix Offre invalide'
            });
          }

          // Récupérer le prix actuel
          // pour vérifier que l'offre
          // est réellement réduite.
          const current =
            await prisma.product.findUnique({
              where: {
                id: req.params.id
              }
            });

          if (!current) {
            return res.status(404).json({
              error:
                'Produit introuvable'
            });
          }

          const normalPrice =
            data.price ??
            current.price;

          if (
            offerPrice >= normalPrice
          ) {
            return res.status(400).json({
              error:
                'Le prix Offre doit être inférieur au prix normal'
            });
          }

          data.offerPrice =
            offerPrice;
        }
      }

      const product =
        await prisma.product.update({
          where: {
            id: req.params.id
          },

          data,

          include: {
            category: true
          }
        });

      res.json(product);

    } catch (err) {
      console.error(
        '[UPDATE_PRODUCT]',
        err
      );

      res.status(500).json({
        error: 'Erreur serveur',
        details: err.message
      });
    }
  }
);


// ============================================================
// DELETE PRODUCT
// ============================================================

router.delete(
  '/products/:id',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    try {
      await prisma.product.update({
        where: {
          id: req.params.id
        },

        data: {
          active: false
        }
      });

      res.json({
        ok: true
      });

    } catch (err) {
      console.error(
        '[DELETE_PRODUCT]',
        err
      );

      res.status(500).json({
        error: 'Erreur serveur',
        details: err.message
      });
    }
  }
);


module.exports = router;
