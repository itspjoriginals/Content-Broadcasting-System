'use strict';

const multer = require('multer');
const logger = require('../utils/logger');
const { sendError } = require('../utils/response');

/**
 * Global error handler.  Must have 4 params for Express to treat it as error middleware.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  logger.error(`[${req.method}] ${req.originalUrl} — ${err.message}`, {
    stack: err.stack,
    userId: req.user?.id,
  });

  // Multer-specific errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxMB = (parseInt(process.env.MAX_FILE_SIZE, 10) / (1024 * 1024)).toFixed(0);
      return sendError(res, `File too large. Maximum allowed size is ${maxMB}MB`, 400);
    }
    return sendError(res, `File upload error: ${err.message}`, 400);
  }

  if (err.code === 'INVALID_FILE_TYPE') {
    return sendError(res, err.message, 400);
  }

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    return sendError(res, 'A record with this value already exists', 409);
  }

  // Default 500
  const message =
    process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message;

  return sendError(res, message, err.statusCode || 500);
};

/**
 * 404 handler for unmatched routes.
 */
const notFoundHandler = (req, res) => {
  return sendError(res, `Route ${req.originalUrl} not found`, 404);
};

module.exports = { errorHandler, notFoundHandler };
