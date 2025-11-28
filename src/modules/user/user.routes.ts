import { Router } from 'express';
import userController from './user.controller';
import { authMiddleware, adminOnly } from '../../middlewares/authMiddleware'; // ✅ TO'G'RI IMPORT
import { validate } from '../../middlewares/validateMiddleware';
import { authLimiter } from '../../middlewares/rateLimiterMiddleware';
import authValidation from '../../middlewares/userValidation';

const router = Router();

// ✅ Arrow function bilan wrap qilish
router.post(
  '/register',
  authLimiter,
  validate(authValidation.register),
  (req, res) => userController.register(req, res)
);

router.post(
  '/login',
  authLimiter,
  validate(authValidation.login),
  (req, res) => userController.login(req, res)
);

router.post(
  '/refresh',
  (req, res) => userController.refreshToken(req, res)
);

router.post(
  '/logout',
  (req, res) => userController.logout(req, res)
);

router.post(
  '/logout-all',
  authMiddleware,
  (req, res) => userController.logoutAll(req, res)
);

router.get(
  '/me',
  authMiddleware,
  (req, res) => userController.getMe(req, res)
);

router.put(
  '/change-password',
  authMiddleware,
  validate(authValidation.changePassword),
  (req, res) => userController.changePassword(req, res)
);

router.get(
  '/profile/:id',
  authMiddleware,
  adminOnly,
  (req, res) => userController.getUserById(req, res)
);

export default router;