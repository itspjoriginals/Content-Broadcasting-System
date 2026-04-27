'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getPool } = require('../config/database');
const logger = require('./logger');

const run = async () => {
  const pool = getPool();

  const principalId = uuidv4();
  const hashedPassword = await bcrypt.hash('Admin@1234', 12);

  // Upsert principal account
  await pool.execute(
    `INSERT INTO users (id, name, email, password_hash, role)
     VALUES (?, ?, ?, ?, 'principal')
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [principalId, 'Principal Admin', 'principal@school.com', hashedPassword]
  );

  logger.info('Seed complete. Principal: principal@school.com / Admin@1234');

  // Demo teachers
  const teachers = [
    { name: 'Alice Teacher', email: 'alice@school.com' },
    { name: 'Bob Teacher',   email: 'bob@school.com'   },
  ];

  for (const t of teachers) {
    const teacherHash = await bcrypt.hash('Teacher@1234', 12);
    await pool.execute(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES (?, ?, ?, ?, 'teacher')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [uuidv4(), t.name, t.email, teacherHash]
    );
    logger.info(`Teacher seeded: ${t.email} / Teacher@1234`);
  }

  await pool.end();
};

run().catch((err) => {
  logger.error('Seed failed', err);
  process.exit(1);
});
