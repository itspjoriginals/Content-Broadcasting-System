'use strict';

require('dotenv').config();
const app = require('./app');
const { initializePool } = require('./config/database');
const { getRedisClient } = require('./config/redis');
const logger = require('./utils/logger');
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const PORT = parseInt(process.env.PORT, 10) || 3000;

const startServer = async () => {
  try {
    // Initialize DB pool (validates connection on first query)
    initializePool();

    // Eagerly connect Redis (optional — falls back gracefully if unavailable)
    const redisClient = getRedisClient();
    await redisClient.connect().catch((err) => {
      logger.warn(`Redis not available, caching disabled: ${err.message}`);
    });

    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        try {
          await redisClient.quit();
        } catch (_) {}
        logger.info('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', reason);
    });

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      process.exit(1);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
