'use strict';

const { query } = require('../config/database');
const { sendSuccess } = require('../utils/response');

/**
 * GET /users/teachers — Principal: list all teachers
 */
const listTeachers = async (req, res, next) => {
  try {
    const teachers = await query(
      `SELECT id, name, email, is_active, created_at FROM users WHERE role = 'teacher' ORDER BY name ASC`
    );
    return sendSuccess(res, teachers);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /users/me — Profile of authenticated user
 */
const getProfile = (req, res) => {
  const { id, name, email, role } = req.user;
  return sendSuccess(res, { id, name, email, role });
};

module.exports = { listTeachers, getProfile };
