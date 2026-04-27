'use strict';

const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;

const getRedisClient = () => {
  if (redisClient) return redisClient;

  const config = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  };

  if (process.env.REDIS_PASSWORD) {
    config.password = process.env.REDIS_PASSWORD;
  }

  redisClient = new Redis(config);

  redisClient.on('connect', () => logger.info('Redis connected'));
  redisClient.on('error', (err) => logger.warn(`Redis error: ${err.message}`));

  return redisClient;
};

/**
 * Get value from cache. Returns null on miss or Redis unavailability.
 */
const cacheGet = async (key) => {
  try {
    const client = getRedisClient();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    logger.warn(`Cache GET failed [${key}]: ${err.message}`);
    return null;
  }
};

/**
 * Set value in cache with TTL (seconds).
 */
const cacheSet = async (key, value, ttl = null) => {
  try {
    const client = getRedisClient();
    const effectiveTTL = ttl || parseInt(process.env.REDIS_TTL, 10) || 300;
    await client.setex(key, effectiveTTL, JSON.stringify(value));
  } catch (err) {
    logger.warn(`Cache SET failed [${key}]: ${err.message}`);
  }
};

/**
 * Delete one or more cache keys (supports wildcard via scan+delete).
 */
const cacheDel = async (pattern) => {
  try {
    const client = getRedisClient();
    if (pattern.includes('*')) {
      const keys = await client.keys(pattern);
      if (keys.length > 0) await client.del(...keys);
    } else {
      await client.del(pattern);
    }
  } catch (err) {
    logger.warn(`Cache DEL failed [${pattern}]: ${err.message}`);
  }
};

module.exports = { getRedisClient, cacheGet, cacheSet, cacheDel };
