import { Router } from 'express';
import userController from './user.controller';
import { authenticate } from '../../middlewares/authenticate';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Ro'yxatdan o'tish
 *     description: Yangi user yaratish
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - email
 *               - firstName
 *               - lastName
 *               - phone
 *             properties:
 *               username:
 *                 type: string
 *                 example: john_doe
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: password123
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               phone:
 *                 type: string
 *                 example: +998901234567
 *     responses:
 *       201:
 *         description: User yaratildi
 *       400:
 *         description: Validatsiya xatosi
 */
router.post('/register', userController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Tizimga kirish
 *     description: Username va parol bilan login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: john_doe
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login muvaffaqiyatli
 *       401:
 *         description: Noto'g'ri username yoki parol
 */
router.post('/login', userController.login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Access token ni yangilash
 *     description: Refresh token orqali yangi access token olish
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Token yangilandi
 *       401:
 *         description: Refresh token topilmadi yoki yaroqsiz
 */
router.post('/refresh', userController.refreshToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Tizimdan chiqish
 *     description: Refresh token ni bekor qilish
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logout muvaffaqiyatli
 */
router.post('/logout', userController.logout);

/**
 * @swagger
 * /api/auth/logout-all:
 *   post:
 *     summary: Barcha qurilmalardan chiqish
 *     description: User ning barcha refresh tokenlarini bekor qilish
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Barcha qurilmalardan chiqildi
 *       401:
 *         description: Autentifikatsiya talab qilinadi
 */
router.post('/logout-all', authenticate, userController.logoutAll);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Hozirgi user ma'lumotlari
 *     description: Tokendan user ma'lumotlarini olish
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User ma'lumotlari
 *       401:
 *         description: Autentifikatsiya talab qilinadi
 */
router.get('/me', authenticate, userController.getMe);

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     summary: Parolni o'zgartirish
 *     description: Hozirgi user parolini yangilash
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Parol o'zgartirildi
 *       400:
 *         description: Eski parol noto'g'ri
 *       401:
 *         description: Autentifikatsiya talab qilinadi
 */
router.put('/change-password', authenticate, userController.changePassword);

/**
 * @swagger
 * /api/auth/profile/{id}:
 *   get:
 *     summary: User ma'lumotlarini ID bo'yicha olish
 *     description: Faqat o'z profilini ko'rish mumkin (admin barcha userlarni ko'radi)
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User ma'lumotlari
 *       403:
 *         description: Bu profil sizga tegishli emas
 *       404:
 *         description: User topilmadi
 */
router.get('/profile/:id', authenticate, userController.getUserById);

export default router;
