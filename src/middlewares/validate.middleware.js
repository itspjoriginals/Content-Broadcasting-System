'use strict';

const { validationResult } = require('express-validator');
const { sendError } = require('../utils/response');

/**
 * Runs after express-validator chains and returns 422 on failure.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      field: e.path || e.param,
      message: e.msg,
    }));
    return sendError(res, 'Validation failed', 422, formatted);
  }
  next();
};

module.exports = { validate };
