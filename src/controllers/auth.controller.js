'use strict';

const authService = require('../services/auth.service');
const { sendSuccess, sendError } = require('../utils/response');

const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const result = await authService.register({ name, email, password, role });
    return sendSuccess(res, result, 'Registration successful', 201);
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    return sendSuccess(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
};

const me = (req, res) => {
  const { id, name, email, role } = req.user;
  return sendSuccess(res, { id, name, email, role });
};

module.exports = { register, login, me };
