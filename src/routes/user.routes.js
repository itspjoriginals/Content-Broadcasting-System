'use strict';

const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const userController = require('../controllers/user.controller');

const router = express.Router();

router.use(authenticate);

// GET /users/me
router.get('/me', userController.getProfile);

// GET /users/teachers — principal only
router.get('/teachers', authorize('principal'), userController.listTeachers);

module.exports = router;
