'use strict';

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { sendUnauthorized, sendForbidden } = require('../utils/response');

/**
 * Verifies JWT and attaches decoded user to req.user.
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendUnauthorized(res, 'Authorization token missing');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user record to catch deactivated accounts
    const [user] = await query(
      `SELECT id, name, email, role, is_active FROM users WHERE id = ? LIMIT 1`,
      [decoded.id]
    );

    if (!user) return sendUnauthorized(res, 'User not found');
    if (!user.is_active) return sendUnauthorized(res, 'Account is deactivated');

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendUnauthorized(res, 'Token has expired');
    }
    return sendUnauthorized(res, 'Invalid token');
  }
};

/**
 * Role-based access control middleware factory.
 * Usage: authorize('principal') or authorize('teacher') or authorize('principal','teacher')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return sendUnauthorized(res);

    if (!roles.includes(req.user.role)) {
      return sendForbidden(
        res,
        `Role '${req.user.role}' is not permitted to access this resource`
      );
    }
    next();
  };
};

module.exports = { authenticate, authorize };
