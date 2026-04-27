'use strict';

const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = express.Router();

// ── POST /auth/register ──────────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 150 }),
    body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and a number'),
    body('role')
      .isIn(['teacher'])
      .withMessage("Role must be 'teacher' (principals are provisioned by admins)"),
  ],
  validate,
  authController.register
);

// ── POST /auth/login ─────────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  authController.login
);

// ── GET /auth/me ─────────────────────────────────────────────────────────────
router.get('/me', authenticate, authController.me);

module.exports = router;
