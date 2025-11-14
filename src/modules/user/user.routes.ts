import { Router } from 'express';
import userController from './user.controller';
import { authMiddleware, adminOnly } from '../../middlewares/authMiddleware';
import { validate } from '../../middlewares/validateMiddleware';
import { authLimiter } from '../../middlewares/rateLimiterMiddleware';
import authValidation from '../../middlewares/userValidation';

/**
 * User Routes
 */
const router = Router();

/**
 * POST /api/auth/register
 * 
 * Ro'yxatdan o'tish
 * - Parol avtomatik hash qilinadi
 * - Access token (15 min) va Refresh token (7 kun) yaratiladi
 * - Refresh token cookie ga saqlanadi
 */
router.post(
  '/register',
  authLimiter,
  validate(authValidation.register),
  userController.register
);

/**
 * POST /api/auth/login
 * 
 * Login qilish
 * - Access token va Refresh token yaratiladi
 * - Refresh token cookie ga saqlanadi
 */
router.post(
  '/login',
  authLimiter,
  validate(authValidation.login),
  userController.login
);

/**
 * POST /api/auth/refresh
 * 
 * Token yangilash
 * - Refresh token cookie dan olinadi
 * - Yangi Access token va Refresh token yaratiladi
 * - Eski Refresh token bekor qilinadi
 */
router.post(
  '/refresh',
  userController.refreshToken
);

/**
 * POST /api/auth/logout
 * 
 * Logout qilish
 * - Refresh token bekor qilinadi
 * - Cookie o'chiriladi
 */
router.post(
  '/logout',
  userController.logout
);

/**
 * POST /api/auth/logout-all
 * 
 * Barcha qurilmalardan chiqish
 * - Barcha Refresh tokenlar bekor qilinadi
 */
router.post(
  '/logout-all',
  authMiddleware,
  userController.logoutAll
);

/**
 * GET /api/auth/me
 * 
 * Hozirgi userni olish
 */
router.get(
  '/me',
  authMiddleware,
  userController.getMe
);

/**
 * PUT /api/auth/change-password
 * 
 * Parolni o'zgartirish
 */
router.put(
  '/change-password',
  authMiddleware,
  validate(authValidation.changePassword),
  userController.changePassword
);

/**
 * GET /api/auth/profile/:id
 * 
 * User ID bo'yicha ma'lumot olish (Admin only)
 */
router.get(
  '/profile/:id',
  authMiddleware,
  adminOnly,
  userController.getUserById
);

export default router;