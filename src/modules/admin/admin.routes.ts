import { Router } from 'express';
import adminController from './admin.controller';
import adminService from './admin.service';
import { authMiddleware, adminOnly } from '../../middlewares/authMiddleware';
import { adminLimiter } from '../../middlewares/rateLimiterMiddleware';
import { Request, Response } from 'express';

const router = Router();

/**
 * Barcha admin routelar himoyalangan
 * authMiddleware - JWT token tekshiradi
 * adminOnly - Faqat admin role'ga ruxsat beradi
 * adminLimiter - Rate limiting qo'shadi
 */
router.use(authMiddleware, adminOnly, adminLimiter);

/**
 * ========================================
 * DASHBOARD ROUTES
 * ========================================
 */

/**
 * @swagger
 * /api/admin/dashboard/stats:
 *   get:
 *     summary: Dashboard statistikasini olish
 *     description: Tizimning umumiy statistikasini va oxirgi importlarni qaytaradi
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistika muvaffaqiyatli olindi
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/dashboard/stats', adminController.getDashboardStats);

/**
 * ========================================
 * USER MANAGEMENT ROUTES
 * ========================================
 */

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Barcha userlarni olish
 *     description: Pagination, search va filter bilan userlar ro'yxatini qaytaradi
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Sahifa raqami
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Har bir sahifadagi elementlar soni
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Qidiruv so'zi (username, email, firstName, lastName bo'yicha)
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, admin]
 *         description: Role bo'yicha filtrlash
 *     responses:
 *       200:
 *         description: Userlar ro'yxati muvaffaqiyatli olindi
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/users', adminController.getAllUsers);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   put:
 *     summary: Userni tahrirlash
 *     description: User ma'lumotlarini yangilash
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               phone:
 *                 type: string
 *                 example: +998901234567
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User muvaffaqiyatli tahrirlandi
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/users/:id', adminController.updateUser);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Userni o'chirish
 *     description: Userni deaktiv qilish (isActive = false)
 *     tags: [Admin]
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
 *         description: User muvaffaqiyatli o'chirildi
 *       400:
 *         description: O'zini o'chira olmaysiz
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/users/:id', adminController.deleteUser);

/**
 * ========================================
 * IMPORT MANAGEMENT ROUTES
 * ========================================
 */

/**
 * @swagger
 * /api/admin/imports:
 *   get:
 *     summary: Barcha importlarni olish
 *     description: Pagination va status filter bilan importlar ro'yxatini qaytaradi
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Sahifa raqami
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Har bir sahifadagi elementlar soni
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         description: Status bo'yicha filtrlash
 *     responses:
 *       200:
 *         description: Importlar ro'yxati muvaffaqiyatli olindi
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/imports', adminController.getAllImports);

/**
 * @swagger
 * /api/admin/imports/{id}:
 *   get:
 *     summary: Import ma'lumotlarini olish
 *     description: Bitta importning to'liq ma'lumotlari va bog'liq checks/fakturas
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Import ID
 *     responses:
 *       200:
 *         description: Import ma'lumotlari muvaffaqiyatli olindi
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/imports/:id', adminController.getImportDetails);

/**
 * @swagger
 * /api/admin/users/{id}/role:
 *   put:
 *     summary: User roleni o'zgartirish
 *     description: Userning roleni user yoki admin qilib o'zgartirish
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *                 example: admin
 *     responses:
 *       200:
 *         description: Role muvaffaqiyatli o'zgartirildi
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
 *                   example: User admin qilindi
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/users/:id/role', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || (role !== 'user' && role !== 'admin')) {
      res.status(400).json({
        success: false,
        message: 'Role "user" yoki "admin" bo\'lishi kerak',
      });
      return;
    }

    const user = await adminService.changeUserRole(parseInt(id), role);

    res.status(200).json({
      success: true,
      message: `User ${role} qilindi`,
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Xato';
    res.status(500).json({
      success: false,
      message,
    });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}/make-admin:
 *   post:
 *     summary: Userni admin qilish
 *     description: User roleni admin ga o'zgartirish
 *     tags: [Admin]
 *     security:
 *      - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User admin qilindi
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
 *                   example: User admin qilindi
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/users/:id/make-admin', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await adminService.makeAdmin(parseInt(id));

    res.status(200).json({
      success: true,
      message: 'User admin qilindi',
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Xato';
    res.status(500).json({
      success: false,
      message,
    });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}/remove-admin:
 *   post:
 *     summary: Admin roleni olib tashlash
 *     description: Admin roleni olib tashlash va userni oddiy user qilish
 *     tags: [Admin]
 *     security:
 *      - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: Admin roli olib tashlandi
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
 *                   example: Admin roli olib tashlandi
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/users/:id/remove-admin', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await adminService.removeAdmin(parseInt(id));

    res.status(200).json({
      success: true,
      message: 'Admin roli olib tashlandi',
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Xato';
    res.status(500).json({
      success: false,
      message,
    });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}/block:
 *   post:
 *     summary: Userni bloklash
 *     description: Userni bloklash (isActive = false)
 *     tags: [Admin]
 *     security:
 *      - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User bloklandi
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
 *                   example: User bloklandi
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/users/:id/block', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await adminService.blockUser(parseInt(id));

    res.status(200).json({
      success: true,
      message: 'User bloklandi',
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Xato';
    res.status(500).json({
      success: false,
      message,
    });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}/unblock:
 *   post:
 *     summary: Userni aktivlashtirish
 *     description: Bloklangan userni aktivlashtirish (isActive = true)
 *     tags: [Admin]
 *     security:
 *      - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User aktivlashtirildi
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
 *                   example: User aktivlashtirildi
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/users/:id/unblock', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await adminService.unblockUser(parseInt(id));

    res.status(200).json({
      success: true,
      message: 'User aktivlashtirildi',
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Xato';
    res.status(500).json({
      success: false,
      message,
    });
  }
});

/**
 * @swagger
 * /api/admin/admins:
 *   get:
 *     summary: Barcha adminlarni olish
 *     description: Tizimda mavjud barcha adminlar ro'yxatini qaytaradi
 *     tags: [Admin]
 *     security:
 *      - BearerAuth: []
 *     responses:
 *       200:
 *         description: Adminlar ro'yxati muvaffaqiyatli olindi
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
 *                     admins:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     total:
 *                       type: integer
 *                       example: 5
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/admins', async (req: Request, res: Response) => {
  try {
    const admins = await adminService.getAllAdmins();

    res.status(200).json({
      success: true,
      data: {
        admins: admins.map((a) => a.toJSON()),
        total: admins.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Adminlarni olishda xato',
    });
  }
});

export default router;
