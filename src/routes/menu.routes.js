const router = require('express').Router();
const prisma = require('../utils/prisma');
const {
  requireAuth,
  requireRole
} = require('../middleware/auth');


// ============================================================
// PUBLIC MENU
// ============================================================

router.get('/menu', async (req, res) => {
  try {
    const categories =
      await prisma.category.findMany({
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

    const menu =
      categories.map(category => ({
        id: category.id,
        name: category.name,
        icon: category.icon,

        items:
          category.products.map(product => ({
            id: product.id,
            name: product.name,
            price: product.price,
            offerPrice:
              product.offerPrice,
            imageUrl:
              product.imageUrl,
            isSignature:
              product.isSignature,
            active:
              product.active,
            categoryId:
              product.categoryId
          }))
      }));

    res.json(menu);

  } catch (err) {
    console.error(
      '[GET_MENU]',
      err
    );

    res.status(500).json({
      error: 'Erreur serveur',
      details: err.message
    });
  }
});


// ============================================================
// CATEGORIES
// ============================================================

router.get(
  '/categories',
  async (req, res) => {
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
      console.error(
        '[GET_CATEGORIES]',
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

      if (
        !name ||
        !String(name).trim()
      ) {
        return res.status(400).json({
          error:
            'Nom de catégorie requis'
        });
      }

      const category =
        await prisma.category.create({
          data: {
            name:
              String(name).trim(),

            icon:
              icon || '📂',

            position:
              Number.isFinite(
                Number(position)
              )
                ? Number(position)
                : 0
          }
        });

      res.status(201).json(
        category
      );

    } catch (err) {
      console.error(
        '[CREATE_CATEGORY]',
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
// UPDATE CATEGORY
// ============================================================

router.patch(
  '/categories/:id',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    try {
      const data = {};

      if (
        req.body.name !== undefined
      ) {
        data.name =
          String(
            req.body.name
          ).trim();
      }

      if (
        req.body.icon !== undefined
      ) {
        data.icon =
          req.body.icon;
      }

      if (
        req.body.position !== undefined
      ) {
        data.position =
          Number(
            req.body.position
          );
      }

      if (
        req.body.active !== undefined
      ) {
        data.active =
          Boolean(
            req.body.active
          );
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
      console.error(
        '[UPDATE_CATEGORY]',
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
      console.error(
        '[DELETE_CATEGORY]',
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
// GET PRODUCTS
// ============================================================

router.get(
  '/products',
  async (req, res) => {
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
      console.error(
        '[GET_PRODUCTS]',
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
        !Number.isFinite(
          numericPrice
        ) ||
        numericPrice < 0
      ) {
        return res.status(400).json({
          error:
            'Prix invalide'
        });
      }

      let numericOfferPrice =
        null;

      if (
        offerPrice !== '' &&
        offerPrice != null
      ) {
        numericOfferPrice =
          parseFloat(
            offerPrice
          );

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
          numericOfferPrice >=
          numericPrice
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
              Boolean(isSignature),

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

      res.status(201).json(
        product
      );

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

      if (
        req.body.name !== undefined
      ) {
        data.name =
          String(
            req.body.name
          ).trim();
      }

      if (
        req.body.price !== undefined
      ) {
        const price =
          parseFloat(
            req.body.price
          );

        if (
          !Number.isFinite(price) ||
          price < 0
        ) {
          return res.status(400).json({
            error:
              'Prix invalide'
          });
        }

        data.price = price;
      }

      if (
        req.body.categoryId !==
        undefined
      ) {
        data.categoryId =
          req.body.categoryId;
      }

      if (
        req.body.imageUrl !==
        undefined
      ) {
        data.imageUrl =
          req.body.imageUrl ||
          null;
      }

      if (
        req.body.isSignature !==
        undefined
      ) {
        data.isSignature =
          Boolean(
            req.body.isSignature
          );
      }

      if (
        req.body.points !==
        undefined
      ) {
        data.points =
          Number(
            req.body.points
          ) || 0;
      }

      if (
        req.body.stockQty !==
        undefined
      ) {
        data.stockQty =
          req.body.stockQty ===
            '' ||
          req.body.stockQty == null
            ? null
            : Number(
                req.body.stockQty
              );
      }

      // Compatibilité avec
      // l'ancien système d'offre
      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          'offerPrice'
        )
      ) {
        if (
          req.body.offerPrice ===
            '' ||
          req.body.offerPrice ==
            null
        ) {
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
            offerPrice >=
            normalPrice
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


// ============================================================
// OFFERS
// ============================================================


// GET ALL OFFERS
router.get(
  '/offers',
  async (req, res) => {
    try {
      const offers =
        await prisma.offer.findMany({
          where: {
            active: true
          },

          orderBy: {
            createdAt: 'desc'
          },

          include: {
            products: {
              include: {
                product: {
                  include: {
                    category: true
                  }
                }
              },

              orderBy: {
                product: {
                  name: 'asc'
                }
              }
            }
          }
        });

      res.json(offers);

    } catch (err) {
      console.error(
        '[GET_OFFERS]',
        err
      );

      res.status(500).json({
        error: 'Erreur serveur',
        details: err.message
      });
    }
  }
);


// CREATE OFFER
router.post(
  '/offers',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    try {
      const {
        name,
        price,
        productIds
      } = req.body;

      if (
        !name ||
        !String(name).trim()
      ) {
        return res.status(400).json({
          error:
            'Nom de l’offre requis'
        });
      }

      const offerPrice =
        parseFloat(price);

      if (
        !Number.isFinite(
          offerPrice
        ) ||
        offerPrice < 0
      ) {
        return res.status(400).json({
          error:
            'Prix de l’offre invalide'
        });
      }

      if (
        !Array.isArray(
          productIds
        ) ||
        productIds.length === 0
      ) {
        return res.status(400).json({
          error:
            'Ajoutez au moins un produit'
        });
      }

      // Supprimer les doublons
      const uniqueProductIds =
        [
          ...new Set(
            productIds.map(
              id => String(id)
            )
          )
        ];

      // Vérifier que tous les produits
      // existent
      const products =
        await prisma.product.findMany({
          where: {
            id: {
              in: uniqueProductIds
            },

            active: true
          }
        });

      if (
        products.length !==
        uniqueProductIds.length
      ) {
        return res.status(400).json({
          error:
            'Un ou plusieurs produits sont introuvables'
        });
      }

      const offer =
        await prisma.offer.create({
          data: {
            name:
              String(name).trim(),

            price:
              offerPrice,

            products: {
              create:
                uniqueProductIds.map(
                  productId => ({
                    productId,
                    quantity: 1
                  })
                )
            }
          },

          include: {
            products: {
              include: {
                product: {
                  include: {
                    category: true
                  }
                }
              }
            }
          }
        });

      res.status(201).json(
        offer
      );

    } catch (err) {
      console.error(
        '[CREATE_OFFER]',
        err
      );

      res.status(500).json({
        error: 'Erreur serveur',
        details: err.message
      });
    }
  }
);


// UPDATE OFFER
router.patch(
  '/offers/:id',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    try {
      const {
        name,
        price,
        productIds,
        active
      } = req.body;

      const data = {};

      if (
        name !== undefined
      ) {
        data.name =
          String(name).trim();
      }

      if (
        price !== undefined
      ) {
        const offerPrice =
          parseFloat(price);

        if (
          !Number.isFinite(
            offerPrice
          ) ||
          offerPrice < 0
        ) {
          return res.status(400).json({
            error:
              'Prix de l’offre invalide'
          });
        }

        data.price =
          offerPrice;
      }

      if (
        active !== undefined
      ) {
        data.active =
          Boolean(active);
      }

      // Mise à jour de l'offre
      await prisma.offer.update({
        where: {
          id: req.params.id
        },

        data
      });

      // Remplacer la liste des produits
      if (
        Array.isArray(productIds)
      ) {
        const uniqueProductIds =
          [
            ...new Set(
              productIds.map(
                id => String(id)
              )
            )
          ];

        const products =
          await prisma.product.findMany({
            where: {
              id: {
                in:
                  uniqueProductIds
              },

              active: true
            }
          });

        if (
          products.length !==
          uniqueProductIds.length
        ) {
          return res.status(400).json({
            error:
              'Un ou plusieurs produits sont introuvables'
          });
        }

        await prisma.offerProduct.deleteMany({
          where: {
            offerId:
              req.params.id
          }
        });

        if (
          uniqueProductIds.length
        ) {
          await prisma.offerProduct.createMany({
            data:
              uniqueProductIds.map(
                productId => ({
                  offerId:
                    req.params.id,

                  productId,

                  quantity: 1
                })
              )
          });
        }
      }

      const updated =
        await prisma.offer.findUnique({
          where: {
            id: req.params.id
          },

          include: {
            products: {
              include: {
                product: {
                  include: {
                    category: true
                  }
                }
              }
            }
          }
        });

      res.json(updated);

    } catch (err) {
      console.error(
        '[UPDATE_OFFER]',
        err
      );

      res.status(500).json({
        error: 'Erreur serveur',
        details: err.message
      });
    }
  }
);


// DELETE / DISABLE OFFER
router.delete(
  '/offers/:id',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  async (req, res) => {
    try {
      await prisma.offer.update({
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
        '[DELETE_OFFER]',
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
