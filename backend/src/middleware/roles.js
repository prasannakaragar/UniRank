/**
 * middleware/roles.js
 * Role-based access control middleware.
 */

import User from '../models/User.js';

const ROLE_SUPERADMIN = 'superadmin';

/**
 * Factory: restricts access to specific roles.
 * Superadmin always has master access.
 *
 * Usage: router.get('/admin/stats', verifyToken, rolesRequired('admin', 'superadmin'), handler)
 */
export function rolesRequired(...roles) {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Superadmin has master access to everything
      if (user.role === ROLE_SUPERADMIN) {
        req.user = user;
        return next();
      }

      if (!roles.includes(user.role)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `This action requires one of the following roles: ${roles.join(', ')}`,
        });
      }

      req.user = user;
      next();
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error.' });
    }
  };
}

/** Shorthand for @roles_required('admin', 'superadmin') */
export function adminOnly(req, res, next) {
  return rolesRequired('admin', ROLE_SUPERADMIN)(req, res, next);
}

/** Shorthand for @roles_required('mentor', 'admin', 'superadmin') */
export function mentorOrAdmin(req, res, next) {
  return rolesRequired('mentor', 'admin', ROLE_SUPERADMIN)(req, res, next);
}
