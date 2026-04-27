'use strict';

require('dotenv').config();
const { getPool } = require('../config/database');
const logger = require('./logger');

const migrations = [
  // ─── Users ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS users (
    id          VARCHAR(36)  NOT NULL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role        ENUM('principal','teacher') NOT NULL,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email),
    INDEX idx_users_role  (role)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ─── Content ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS content (
    id               VARCHAR(36)   NOT NULL PRIMARY KEY,
    title            VARCHAR(255)  NOT NULL,
    description      TEXT,
    subject          VARCHAR(100)  NOT NULL,
    file_url         VARCHAR(500)  NOT NULL,
    file_path        VARCHAR(500)  NOT NULL,
    file_type        VARCHAR(50)   NOT NULL,
    file_size        BIGINT        NOT NULL,
    original_name    VARCHAR(255)  NOT NULL,
    uploaded_by      VARCHAR(36)   NOT NULL,
    status           ENUM('uploaded','pending','approved','rejected') NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    approved_by      VARCHAR(36),
    approved_at      DATETIME,
    start_time       DATETIME,
    end_time         DATETIME,
    rotation_duration INT          DEFAULT 5 COMMENT 'minutes per rotation slot',
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_content_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_content_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_content_uploaded_by (uploaded_by),
    INDEX idx_content_status      (status),
    INDEX idx_content_subject     (subject),
    INDEX idx_content_schedule    (status, start_time, end_time)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ─── Content Slots (subject registry per teacher) ─────────
  `CREATE TABLE IF NOT EXISTS content_slots (
    id          VARCHAR(36)  NOT NULL PRIMARY KEY,
    teacher_id  VARCHAR(36)  NOT NULL,
    subject     VARCHAR(100) NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_slots_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_slot_teacher_subject (teacher_id, subject),
    INDEX idx_slots_teacher (teacher_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ─── Content Schedule (rotation ordering per slot) ────────
  `CREATE TABLE IF NOT EXISTS content_schedule (
    id              VARCHAR(36) NOT NULL PRIMARY KEY,
    content_id      VARCHAR(36) NOT NULL,
    slot_id         VARCHAR(36) NOT NULL,
    rotation_order  INT         NOT NULL DEFAULT 0,
    duration        INT         NOT NULL DEFAULT 5 COMMENT 'minutes',
    created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_schedule_content FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
    CONSTRAINT fk_schedule_slot    FOREIGN KEY (slot_id)    REFERENCES content_slots(id) ON DELETE CASCADE,
    UNIQUE KEY uq_schedule_content (content_id),
    INDEX idx_schedule_slot (slot_id),
    INDEX idx_schedule_order (slot_id, rotation_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

const run = async () => {
  const pool = getPool();
  logger.info('Running migrations...');
  for (const sql of migrations) {
    await pool.execute(sql);
    logger.info(`Migration OK: ${sql.slice(0, 60).replace(/\n/g, ' ')}...`);
  }
  logger.info('All migrations completed');
  await pool.end();
};

run().catch((err) => {
  logger.error('Migration failed', err);
  process.exit(1);
});
