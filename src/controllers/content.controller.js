'use strict';

const contentService = require('../services/content.service');
const { sendSuccess, sendError } = require('../utils/response');

const uploadContent = async (req, res, next) => {
  try {
    if (!req.file) {
      return sendError(res, 'File is required', 400);
    }

    const { title, description, subject, startTime, endTime, rotationDuration } = req.body;

    const result = await contentService.createContent({
      teacherId: req.user.id,
      title,
      description,
      subject,
      file: req.file,
      body: { startTime, endTime, rotationDuration },
    });

    return sendSuccess(res, result, 'Content uploaded and pending approval', 201);
  } catch (err) {
    next(err);
  }
};

const listContent = async (req, res, next) => {
  try {
    const { status, subject, page, limit } = req.query;
    const result = await contentService.listContent({
      userId: req.user.id,
      role: req.user.role,
      status,
      subject,
      page,
      limit,
    });
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

const getContent = async (req, res, next) => {
  try {
    const content = await contentService.getContentById(
      req.params.id,
      req.user.id,
      req.user.role
    );
    return sendSuccess(res, content);
  } catch (err) {
    next(err);
  }
};

const approveContent = async (req, res, next) => {
  try {
    const result = await contentService.approveContent(req.params.id, req.user.id);
    return sendSuccess(res, result, 'Content approved');
  } catch (err) {
    next(err);
  }
};

const rejectContent = async (req, res, next) => {
  try {
    const { rejectionReason } = req.body;
    const result = await contentService.rejectContent(req.params.id, req.user.id, rejectionReason);
    return sendSuccess(res, result, 'Content rejected');
  } catch (err) {
    next(err);
  }
};

const deleteContent = async (req, res, next) => {
  try {
    const result = await contentService.deleteContent(req.params.id, req.user.id, req.user.role);
    return sendSuccess(res, result, 'Content deleted');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  uploadContent,
  listContent,
  getContent,
  approveContent,
  rejectContent,
  deleteContent,
};
