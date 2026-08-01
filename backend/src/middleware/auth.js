/**
 * middleware/auth.js
 * JWT verification middleware.
 * Extracts the token from the Authorization header and attaches req.userId.
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = () => process.env.JWT_SECRET_KEY || 'jwt-secret-change-in-prod';

/**
 * Express middleware: verifies JWT and sets req.userId.
 */
export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET());
    // Flask-JWT-Extended stores identity as `sub` claim
    req.userId = decoded.sub || decoded.userId || decoded.id;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

/**
 * Create a JWT access token (mirrors create_access_token from Flask-JWT-Extended).
 * Uses `sub` claim for the user ID to match Flask-JWT-Extended format.
 */
export function createAccessToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET(), { expiresIn: '7d' });
}
