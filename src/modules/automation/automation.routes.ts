import { Router } from 'express';
import { automationController } from './automation.controller';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { automationLimiter } from '../../middlewares/rateLimiterMiddleware';
import { checkActiveSession, requireSession } from '../../middlewares/sessionMiddleware';

const router = Router();

/**
 * @swagger
 * /api/automation/init:
 *   post:
 *     summary: Browser ni initialize qilish va session boshlash
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               headless:
 *                 type: boolean
 *                 default: true
 *                 description: Browser ko'rinmas rejimda ishlatilsinmi
 *           example:
 *             headless: true
 *     responses:
 *       200:
 *         description: Browser va session muvaffaqiyatli yaratildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     sessionId:
 *                       type: number
 *                     headless:
 *                       type: boolean
 *       409:
 *         description: Faol session mavjud
 *       500:
 *         description: Server xatosi
 */
router.post(
  '/init',
  authMiddleware,
  checkActiveSession,
  automationLimiter,
  automationController.initializeBrowser.bind(automationController)
);

/**
 * @swagger
 * /api/automation/login:
 *   post:
 *     summary: Tax site ga login
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tin
 *               - password
 *             properties:
 *               tin:
 *                 type: string
 *                 description: Soliq to'lovchining STIR raqami
 *                 example: "123456789"
 *               password:
 *                 type: string
 *                 description: Parol
 *                 example: "mypassword123"
 *               captcha:
 *                 type: string
 *                 description: CAPTCHA kodi (ixtiyoriy)
 *                 example: "123456"
 *           example:
 *             tin: "123456789"
 *             password: "mypassword123"
 *             captcha: "123456"
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
 *                 message:
 *                   type: string
 *       400:
 *         description: TIN va parol kiritilishi shart
 *       401:
 *         description: Session topilmadi
 *       500:
 *         description: Login xatosi
 */
router.post(
  '/login',
  authMiddleware,
  requireSession,
  automationLimiter,
  automationController.login.bind(automationController)
);

/**
 * @swagger
 * /api/automation/create-invoice:
 *   post:
 *     summary: Invoice yaratish
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               invoiceNumber:
 *                 type: string
 *                 description: Invoice raqami
 *               contractNumber:
 *                 type: string
 *                 description: Shartnoma raqami
 *               contractDate:
 *                 type: string
 *                 format: date
 *                 description: Shartnoma sanasi
 *               buyerTin:
 *                 type: string
 *                 description: Xaridor STIR
 *               items:
 *                 type: array
 *                 description: Tovar/xizmatlar ro'yxati
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     price:
 *                       type: number
 *                     measureCode:
 *                       type: string
 *                     catalogCode:
 *                       type: string
 *           example:
 *             invoiceNumber: "INV-001"
 *             contractNumber: "CONT-2024-001"
 *             contractDate: "2024-01-15"
 *             buyerTin: "987654321"
 *             items:
 *               - name: "Tovar 1"
 *                 quantity: 10
 *                 price: 50000
 *                 measureCode: "796"
 *                 catalogCode: "10001"
 *     responses:
 *       200:
 *         description: Invoice muvaffaqiyatli yaratildi
 *       401:
 *         description: Login qilinmagan
 *       500:
 *         description: Invoice yaratish xatosi
 */
router.post(
  '/create-invoice',
  authMiddleware,
  requireSession,
  automationLimiter,
  automationController.createInvoice.bind(automationController)
);

/**
 * @swagger
 * /api/automation/logout:
 *   post:
 *     summary: Logout
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logout muvaffaqiyatli
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Session topilmadi
 *       500:
 *         description: Logout xatosi
 */
router.post(
  '/logout',
  authMiddleware,
  requireSession,
  automationController.logout.bind(automationController)
);

/**
 * @swagger
 * /api/automation/close:
 *   post:
 *     summary: Browser va sessionni yopish
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Session va browser muvaffaqiyatli yopildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Close xatosi
 */
router.post(
  '/close',
  authMiddleware,
  automationController.closeSession.bind(automationController)
);

/**
 * @swagger
 * /api/automation/status:
 *   get:
 *     summary: Session statusini olish
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Session statusi
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
 *                     userId:
 *                       type: number
 *                     hasSession:
 *                       type: boolean
 *                     session:
 *                       type: object
 *                       properties:
 *                         userId:
 *                           type: number
 *                         status:
 *                           type: string
 *                           enum: [idle, running, completed, failed]
 *                         startedAt:
 *                           type: string
 *                         progress:
 *                           type: number
 *                         metadata:
 *                           type: object
 *                     ttl:
 *                       type: number
 *                       description: Qolgan vaqt (sekund)
 *                     expiresIn:
 *                       type: string
 *                       description: Muddati tugash vaqti
 *       500:
 *         description: Status tekshirishda xato
 */
router.get(
  '/status',
  authMiddleware,
  automationController.getStatus.bind(automationController)
);

/**
 * @swagger
 * /api/automation/sessions/all:
 *   get:
 *     summary: Barcha sessionlarni olish (Admin)
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Barcha faol sessionlar
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
 *                     totalSessions:
 *                       type: number
 *                     sessions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: string
 *                           data:
 *                             type: object
 *       500:
 *         description: Sessionlarni olishda xato
 */
router.get(
  '/sessions/all',
  authMiddleware,
  automationController.getAllSessions.bind(automationController)
);

/**
 * @swagger
 * /api/automation/session/refresh:
 *   post:
 *     summary: Session TTL ni yangilash
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Session TTL yangilandi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Session topilmadi
 *       500:
 *         description: TTL yangilashda xato
 */
router.post(
  '/session/refresh',
  authMiddleware,
  requireSession,
  automationController.refreshSession.bind(automationController)
);

export default router;