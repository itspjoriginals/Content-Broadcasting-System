'use strict';

const express = require('express');
const { body, query, param } = require('express-validator');
const contentController = require('../controllers/content.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { upload } = require('../config/multer');

const router = express.Router();

// All content routes require authentication
router.use(authenticate);

// ── POST /content — Teacher: upload new content ──────────────────────────────
router.post(
  '/',
  authorize('teacher'),
  upload.single('file'),
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 255 }),
    body('subject').trim().notEmpty().withMessage('Subject is required').isLength({ max: 100 }),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('startTime')
      .optional({ checkFalsy: true })
      .isISO8601()
      .withMessage('startTime must be a valid ISO 8601 date'),
    body('endTime')
      .optional({ checkFalsy: true })
      .isISO8601()
      .withMessage('endTime must be a valid ISO 8601 date')
      .custom((value, { req }) => {
        if (req.body.startTime && value && new Date(value) <= new Date(req.body.startTime)) {
          throw new Error('endTime must be after startTime');
        }
        return true;
      }),
    body('rotationDuration')
      .optional({ checkFalsy: true })
      .isInt({ min: 1, max: 1440 })
      .withMessage('rotationDuration must be between 1 and 1440 minutes'),
  ],
  validate,
  contentController.uploadContent
);

// ── GET /content — List content (teacher: own, principal: all) ───────────────
router.get(
  '/',
  [
    query('status').optional().isIn(['pending', 'approved', 'rejected', 'uploaded']),
    query('subject').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  contentController.listContent
);

// ── GET /content/:id — Single content detail ────────────────────────────────
router.get(
  '/:id',
  [param('id').isUUID().withMessage('Invalid content ID')],
  validate,
  contentController.getContent
);

// ── PATCH /content/:id/approve — Principal: approve ─────────────────────────
router.patch(
  '/:id/approve',
  authorize('principal'),
  [param('id').isUUID().withMessage('Invalid content ID')],
  validate,
  contentController.approveContent
);

// ── PATCH /content/:id/reject — Principal: reject ───────────────────────────
router.patch(
  '/:id/reject',
  authorize('principal'),
  [
    param('id').isUUID().withMessage('Invalid content ID'),
    body('rejectionReason')
      .trim()
      .notEmpty()
      .withMessage('Rejection reason is required')
      .isLength({ max: 1000 }),
  ],
  validate,
  contentController.rejectContent
);

// ── DELETE /content/:id — Teacher (own) or Principal ────────────────────────
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Invalid content ID')],
  validate,
  contentController.deleteContent
);

module.exports = router;
