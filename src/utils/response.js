'use strict';

/**
 * Sends a standardized success response.
 */
const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = { success: true, message };
  if (data !== null && data !== undefined) response.data = data;
  return res.status(statusCode).json(response);
};

/**
 * Sends a standardized error response.
 */
const sendError = (res, message = 'Internal Server Error', statusCode = 500, errors = null) => {
  const response = { success: false, message };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

/**
 * Sends a 404 not found response.
 */
const sendNotFound = (res, message = 'Resource not found') => {
  return sendError(res, message, 404);
};

/**
 * Sends a 403 forbidden response.
 */
const sendForbidden = (res, message = 'Access denied') => {
  return sendError(res, message, 403);
};

/**
 * Sends a 401 unauthorized response.
 */
const sendUnauthorized = (res, message = 'Authentication required') => {
  return sendError(res, message, 401);
};

module.exports = { sendSuccess, sendError, sendNotFound, sendForbidden, sendUnauthorized };
