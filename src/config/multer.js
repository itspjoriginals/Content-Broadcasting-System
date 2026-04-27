'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_MIME_TYPES = (process.env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/gif')
  .split(',')
  .map((t) => t.trim());

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024; // 10 MB

const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'src/uploads/images');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      Object.assign(new Error(`Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`), {
        code: 'INVALID_FILE_TYPE',
      }),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

/**
 * Delete a file from disk safely (no-throw).
 */
const deleteFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_) {
    // Non-critical; log suppressed intentionally
  }
};

module.exports = { upload, deleteFile, UPLOAD_DIR };
