'use strict';

const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/response');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000;

/**
 * Rate limiter for public broadcast endpoints (students).
 * More lenient window, stricter per-IP limit.
 */
const publicLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_MAX_PUBLIC, 10) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, 'Too many requests, please try again later', 429),
});

/**
 * Rate limiter for private authenticated endpoints.
 */
const privateLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_MAX_PRIVATE, 10) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, 'Too many requests, please try again later', 429),
});

module.exports = { publicLimiter, privateLimiter };
