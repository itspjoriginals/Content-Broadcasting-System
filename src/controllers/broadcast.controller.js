'use strict';

const { query } = require('../config/database');
const scheduleService = require('../services/schedule.service');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /content/live/:teacherId
 * Returns all active (currently rotating) content for a teacher, grouped by subject.
 */
const getLiveByTeacher = async (req, res, next) => {
  try {
    const { teacherId } = req.params;

    // Validate teacher exists
    const [teacher] = await query(
      `SELECT id, name FROM users WHERE id = ? AND role = 'teacher' AND is_active = 1 LIMIT 1`,
      [teacherId]
    );

    if (!teacher) {
      // Per spec: invalid teacher → empty response, not error
      return sendSuccess(res, null, 'No content available');
    }

    const liveContent = await scheduleService.getLiveContentForTeacher(teacherId);

    if (!liveContent || Object.keys(liveContent).length === 0) {
      return sendSuccess(res, null, 'No content available');
    }

    return sendSuccess(res, {
      teacher: { id: teacher.id, name: teacher.name },
      live: liveContent,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /content/live/:teacherId/:subject
 * Returns active content for a specific subject under a teacher.
 */
const getLiveByTeacherAndSubject = async (req, res, next) => {
  try {
    const { teacherId, subject } = req.params;

    const [teacher] = await query(
      `SELECT id, name FROM users WHERE id = ? AND role = 'teacher' AND is_active = 1 LIMIT 1`,
      [teacherId]
    );

    if (!teacher) {
      return sendSuccess(res, null, 'No content available');
    }

    const activeContent = await scheduleService.getLiveContentBySubject(teacherId, subject);

    if (!activeContent) {
      return sendSuccess(res, null, 'No content available');
    }

    return sendSuccess(res, {
      teacher: { id: teacher.id, name: teacher.name },
      subject: subject.toLowerCase(),
      content: activeContent,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getLiveByTeacher, getLiveByTeacherAndSubject };
