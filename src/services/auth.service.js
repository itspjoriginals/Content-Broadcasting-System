'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');

const SALT_ROUNDS = 12;

/**
 * Register a new user (teacher only via this route; principal seeded separately).
 */
const register = async ({ name, email, password, role }) => {
  const existing = await query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [email]);
  if (existing.length > 0) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const id = uuidv4();

  await query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
    [id, name, email, passwordHash, role]
  );

  return { id, name, email, role };
};

/**
 * Authenticate user and return JWT.
 */
const login = async ({ email, password }) => {
  const [user] = await query(
    `SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = ? LIMIT 1`,
    [email]
  );

  if (!user) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  if (!user.is_active) {
    const err = new Error('Account is deactivated');
    err.statusCode = 403;
    throw err;
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const payload = { id: user.id, role: user.role };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
};

module.exports = { register, login };
