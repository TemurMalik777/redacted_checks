import { Router } from 'express';
import userController from './user.controller';
import { authMiddleware, adminOnly } from '../../middlewares/authMiddleware';
import { validate } from '../../middlewares/validateMiddleware';
import { authLimiter } from '../../middlewares/rateLimiterMiddleware';
import authValidation from '../../middlewares/userValidation';

/**
 * User Routes
 * 
 * Barcha autentifikatsiya endpointlari
 */
const router = Router();

/**
 * POST /api/auth/register
 * 
 * Ro'yxatdan o'tish
 * 
 * Request body:
 * {
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "phone": "+998901234567",
 *   "email": "john@example.com",
 *   "username": "johndoe",
 *   "password": "password123",
 *   "role": "user" // optional
 * }
 */
router.post(
  '/register',
  authLimiter,  // Rate limiting - 5 requests per 15 minutes
  validate(authValidation.register),
  userController.register
);

/**
 * POST /api/auth/login
 * 
 * Login qilish
 * 
 * Request body:
 * {
 *   "username": "johndoe",
 *   "password": "password123"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Muvaffaqiyatli login qildingiz!",
 *   "data": {
 *     "user": { ... },
 *     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *   }
 * }
 */
router.post(
  '/login',
  authLimiter,  // Rate limiting - 5 requests per 15 minutes
  validate(authValidation.login),
  userController.login
);

/**
 * GET /api/auth/me
 * 
 * Hozirgi userni olish
 * 
 * Headers:
 * Authorization: Bearer <token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "user": {
 *       "id": 1,
 *       "username": "johndoe",
 *       "email": "john@example.com",
 *       "role": "user",
 *       ...
 *     }
 *   }
 * }
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
 * 
 * Headers:
 * Authorization: Bearer <token>
 * 
 * Request body:
 * {
 *   "oldPassword": "oldpass123",
 *   "newPassword": "newpass456"
 * }
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
 * 
 * Headers:
 * Authorization: Bearer <admin-token>
 */
router.get(
  '/profile/:id',
  authMiddleware,
  adminOnly,
  userController.getUserById
);

export default router;