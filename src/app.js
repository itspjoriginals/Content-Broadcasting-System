'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const contentRoutes = require('./routes/content.routes');
const broadcastRoutes = require('./routes/broadcast.routes');
const userRoutes = require('./routes/user.routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const { privateLimiter } = require('./middlewares/rateLimit.middleware');
const logger = require('./utils/logger');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../docs/swagger.json');

const app = express();

// ── Security & Parsing ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGINS || '*', credentials: true }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── HTTP Request Logging ─────────────────────────────────────────────────────
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
    skip: (_req, res) => process.env.NODE_ENV === 'production' && res.statusCode < 400,
  })
);

// ── Swagger UI ───────────────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ── Static Files (uploaded images) ──────────────────────────────────────────
app.use(
  '/uploads',
  express.static(path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'src/uploads/images'), {
    maxAge: '1d',
  })
);

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Private routes — apply general rate limiter
app.use('/api/content', privateLimiter, contentRoutes);

// Public broadcast API (rate limiter applied inside broadcast routes)
app.use('/api/content/live', broadcastRoutes);

// ── Error Handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
