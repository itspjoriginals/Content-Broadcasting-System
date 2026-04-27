'use strict';

const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { query, beginTransaction } = require('../config/database');
const { deleteFile } = require('../config/multer');
const { cacheDel } = require('../config/redis');

/**
 * Create content record after file has been persisted by Multer.
 * Also creates or reuses a content_slot and writes a content_schedule entry.
 */
const createContent = async ({ teacherId, title, description, subject, file, body }) => {
  const { startTime, endTime, rotationDuration } = body;

  const duration = parseInt(rotationDuration, 10) || 5;
  const normalizedSubject = subject.toLowerCase().trim();

  const fileUrl = `${process.env.BASE_URL}/uploads/${file.filename}`;

  const connection = await beginTransaction();
  try {
    const contentId = uuidv4();

    // Insert content row
    await connection.execute(
      `INSERT INTO content
        (id, title, description, subject, file_url, file_path, file_type, file_size,
         original_name, uploaded_by, status, start_time, end_time, rotation_duration)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        contentId,
        title,
        description || null,
        normalizedSubject,
        fileUrl,
        file.path,
        file.mimetype,
        file.size,
        file.originalname,
        teacherId,
        startTime || null,
        endTime || null,
        duration,
      ]
    );

    // Upsert subject slot for this teacher
    const slotId = uuidv4();
    await connection.execute(
      `INSERT INTO content_slots (id, teacher_id, subject)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [slotId, teacherId, normalizedSubject]
    );

    // Fetch actual slot id (may have existed before)
    const [[slot]] = await connection.execute(
      `SELECT id FROM content_slots WHERE teacher_id = ? AND subject = ? LIMIT 1`,
      [teacherId, normalizedSubject]
    );

    // Determine next rotation_order for this slot
    const [[{ maxOrder }]] = await connection.execute(
      `SELECT COALESCE(MAX(rotation_order), -1) AS maxOrder
       FROM content_schedule
       WHERE slot_id = ?`,
      [slot.id]
    );

    await connection.execute(
      `INSERT INTO content_schedule (id, content_id, slot_id, rotation_order, duration)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), contentId, slot.id, maxOrder + 1, duration]
    );

    await connection.commit();
    connection.release();

    return { contentId, subject: normalizedSubject };
  } catch (err) {
    await connection.rollback();
    connection.release();
    deleteFile(file.path); // Remove orphaned upload
    throw err;
  }
};

/**
 * List content with optional filters.
 * Teachers see only their own content.
 * Principal sees all content.
 */
const listContent = async ({ userId, role, status, subject, page = 1, limit = 20 }) => {
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const params = [];
  const conditions = [];

  if (role === 'teacher') {
    conditions.push('c.uploaded_by = ?');
    params.push(userId);
  }

  if (status) {
    conditions.push('c.status = ?');
    params.push(status);
  }

  if (subject) {
    conditions.push('c.subject = ?');
    params.push(subject.toLowerCase().trim());
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSQL = `SELECT COUNT(*) AS total FROM content c ${whereClause}`;
  const [{ total }] = await query(countSQL, [...params]);

  const dataSQL = `
    SELECT
      c.id, c.title, c.description, c.subject,
      c.file_url, c.file_type, c.file_size, c.original_name,
      c.status, c.rejection_reason,
      c.start_time, c.end_time, c.rotation_duration,
      c.created_at, c.updated_at,
      u.id AS teacher_id, u.name AS teacher_name,
      approver.name AS approved_by_name, c.approved_at
    FROM content c
    JOIN users u ON u.id = c.uploaded_by
    LEFT JOIN users approver ON approver.id = c.approved_by
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const items = await query(dataSQL, [...params, parseInt(limit, 10), offset]);

  return {
    items,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get single content by ID with ownership/role check.
 */
const getContentById = async (contentId, userId, role) => {
  const [content] = await query(
    `SELECT c.*, u.name AS teacher_name
     FROM content c JOIN users u ON u.id = c.uploaded_by
     WHERE c.id = ? LIMIT 1`,
    [contentId]
  );

  if (!content) {
    const err = new Error('Content not found');
    err.statusCode = 404;
    throw err;
  }

  if (role === 'teacher' && content.uploaded_by !== userId) {
    const err = new Error('Access denied');
    err.statusCode = 403;
    throw err;
  }

  return content;
};

/**
 * Approve content (principal only).
 */
const approveContent = async (contentId, principalId) => {
  const [content] = await query(`SELECT id, status, uploaded_by FROM content WHERE id = ? LIMIT 1`, [contentId]);

  if (!content) {
    const err = new Error('Content not found');
    err.statusCode = 404;
    throw err;
  }

  if (content.status !== 'pending') {
    const err = new Error(`Cannot approve content with status '${content.status}'`);
    err.statusCode = 400;
    throw err;
  }

  await query(
    `UPDATE content SET status = 'approved', approved_by = ?, approved_at = NOW(), rejection_reason = NULL
     WHERE id = ?`,
    [principalId, contentId]
  );

  // Bust live cache for the teacher
  await cacheDel(`live:${content.uploaded_by}:*`);

  return { contentId, status: 'approved' };
};

/**
 * Reject content (principal only).
 */
const rejectContent = async (contentId, principalId, rejectionReason) => {
  const [content] = await query(`SELECT id, status FROM content WHERE id = ? LIMIT 1`, [contentId]);

  if (!content) {
    const err = new Error('Content not found');
    err.statusCode = 404;
    throw err;
  }

  if (content.status !== 'pending') {
    const err = new Error(`Cannot reject content with status '${content.status}'`);
    err.statusCode = 400;
    throw err;
  }

  await query(
    `UPDATE content SET status = 'rejected', approved_by = ?, approved_at = NOW(), rejection_reason = ?
     WHERE id = ?`,
    [principalId, rejectionReason, contentId]
  );

  return { contentId, status: 'rejected' };
};

/**
 * Delete content (teacher owns it, or principal).
 * Removes file from disk.
 */
const deleteContent = async (contentId, userId, role) => {
  const [content] = await query(`SELECT id, file_path, uploaded_by, status FROM content WHERE id = ? LIMIT 1`, [contentId]);

  if (!content) {
    const err = new Error('Content not found');
    err.statusCode = 404;
    throw err;
  }

  if (role === 'teacher' && content.uploaded_by !== userId) {
    const err = new Error('Access denied');
    err.statusCode = 403;
    throw err;
  }

  await query(`DELETE FROM content WHERE id = ?`, [contentId]);
  deleteFile(content.file_path);
  await cacheDel(`live:${content.uploaded_by}:*`);

  return { contentId };
};

module.exports = {
  createContent,
  listContent,
  getContentById,
  approveContent,
  rejectContent,
  deleteContent,
};
