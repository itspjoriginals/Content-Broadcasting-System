'use strict';

const express = require('express');
const { param } = require('express-validator');
const broadcastController = require('../controllers/broadcast.controller');
const { validate } = require('../middlewares/validate.middleware');
const { publicLimiter } = require('../middlewares/rateLimit.middleware');

const router = express.Router();

// Rate-limit all public broadcast endpoints
router.use(publicLimiter);

// ── GET /content/live/:teacherId ─────────────────────────────────────────────
// Returns all live subject rotations for a teacher
router.get(
  '/:teacherId',
  [param('teacherId').notEmpty().withMessage('Teacher ID is required')],
  validate,
  broadcastController.getLiveByTeacher
);

// ── GET /content/live/:teacherId/:subject ────────────────────────────────────
// Returns live content for a specific subject
router.get(
  '/:teacherId/:subject',
  [
    param('teacherId').notEmpty().withMessage('Teacher ID is required'),
    param('subject').notEmpty().withMessage('Subject is required'),
  ],
  validate,
  broadcastController.getLiveByTeacherAndSubject
);

module.exports = router;
