const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function sign(payload, expiresIn = '12h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
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

module.exports = { sign, optionalAuth, requireAuth, requireRole, JWT_SECRET };
