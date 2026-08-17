const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Durées de session :
//  - Personnel (POS, Admin)  : 12 h — la caisse ne doit pas rester ouverte
//  - Clients (Mon Espace LUX): 90 j — connexion persistante demandée
const STAFF_EXPIRY    = process.env.STAFF_TOKEN_EXPIRY    || '12h';
const CUSTOMER_EXPIRY = process.env.CUSTOMER_TOKEN_EXPIRY || '90d';

function sign(payload, expiresIn) {
  const ttl = expiresIn
    || (payload && payload.role === 'CUSTOMER' ? CUSTOMER_EXPIRY : STAFF_EXPIRY);
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ttl });
}

// Attaches req.user if a valid token is present, but does not block the request.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch (e) { /* ignore invalid token */ }
  }
  next();
}

// Blocks the request unless a valid token is present.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expirée' });
  }
}

// Blocks unless req.user.role is in the allowed list.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Accès refusé' });
    next();
  };
}

module.exports = {
  sign,
  optionalAuth,
  requireAuth,
  requireRole,
  JWT_SECRET,
  STAFF_EXPIRY,
  CUSTOMER_EXPIRY,
};
