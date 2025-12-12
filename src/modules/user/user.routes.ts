import { Router } from 'express';

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User yaratildi
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         description: Validatsiya xatosi
 */
router.post('/register', async (req, res) => {
  res.status(201).json({ success: true, message: 'User registered' });
});

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     accessToken:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     refreshToken:
 *                       type: string
 *       401:
 *         description: Noto'g'ri username yoki parol
 */
router.post('/login', async (req, res) => {
  res.json({
    success: true,
    data: {
      user: {},
      accessToken: 'token...',
      refreshToken: 'refresh...',
    },
  });
});

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 */
router.get('/me', async (req, res) => {
  res.json({ success: true, data: { user: {} } });
});

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
 */
router.put('/change-password', async (req, res) => {
  res.json({ success: true, message: 'Password changed' });
});

export default router;