'use strict';

const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

let pool = null;

/**
 * Initializes MySQL connection pool (singleton).
 */
const initializePool = () => {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    timezone: '+00:00',
  });

  logger.info('MySQL connection pool initialized');
  return pool;
};

/**
 * Returns the active pool (creates if not yet initialized).
 */
const getPool = () => {
  if (!pool) return initializePool();
  return pool;
};

/**
 * Execute a parameterized query safely.
 * @param {string} sql
 * @param {Array} params
 */
const query = async (sql, params = []) => {
  const db = getPool();
  const [rows] = await db.execute(sql, params);
  return rows;
};

/**
 * Begin a transaction and return the connection.
 */
const beginTransaction = async () => {
  const db = getPool();
  const connection = await db.getConnection();
  await connection.beginTransaction();
  return connection;
};

module.exports = { initializePool, getPool, query, beginTransaction };
