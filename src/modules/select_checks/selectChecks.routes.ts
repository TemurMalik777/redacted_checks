import { Router } from 'express';
import { SelectChecksController } from './selectChecks.controller';
import { authMiddleware } from '../../middlewares/authMiddleware';

const router = Router();
const controller = new SelectChecksController();

/**
 * @swagger
 * tags:
 *   name: SelectChecks
 *   description: Select Checks CRUD va Generate API'lari
 */

// =============================================
// 🆕 GENERATE & RESET ENDPOINTS (ENG MUHIM!)
// =============================================

/**
 * @swagger
 * /api/select_checks/generate:
 *   post:
 *     summary: 🚀 Faktura va cheklarni moslashtirish
 *     description: |
 *       Faktura jadvalidagi aktiv yozuvlarni checks jadvali bilan moslashtiradi.
 *
 *       **Jarayon:**
 *       1. Fakturalar SANA bo'yicha tartiblanadi (eski → yangi)
 *       2. Har bir faktura uchun faqat o'sha sanadan KEYIN yaratilgan cheklar olinadi
 *       3. Cheklar summasi faktura summasiga teng yoki 1% gacha ortiq bo'lishi kerak
 *       4. Natijalar select_checks jadvaliga yoziladi
 *
 *       **Tolerans:** 1%
 *     tags: [SelectChecks]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Generate muvaffaqiyatli yakunlandi
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
 *                   example: "150 ta select_check yaratildi"
 *                 data:
 *                   type: object
 *                   properties:
 *                     created:
 *                       type: integer
 *                       description: Yaratilgan select_check'lar soni
 *                       example: 150
 *                     processed:
 *                       type: integer
 *                       description: Muvaffaqiyatli qayta ishlangan
 *                       example: 145
 *                     failed:
 *                       type: integer
 *                       description: Xato bilan yakunlangan
 *                       example: 5
 *       401:
 *         description: Autentifikatsiya talab qilinadi
 *       500:
 *         description: Server xatosi
 */
router.post('/generate', authMiddleware, controller.generate.bind(controller));

/**
 * @swagger
 * /api/select_checks/reset:
 *   post:
 *     summary: ⚠️ Barcha ma'lumotlarni reset qilish
 *     description: |
 *       **EHTIYOT BO'LING!** Bu endpoint:
 *       1. select_checks jadvalini to'liq tozalaydi
 *       2. checks jadvalidagi barcha yozuvlarni processed=false qiladi
 *       3. faktura jadvalidagi barcha yozuvlarni is_active=true qiladi
 *
 *       Bu qayta generate qilish uchun ishlatiladi.
 *     tags: [SelectChecks]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Reset muvaffaqiyatli yakunlandi
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
 *                   example: "Barcha ma'lumotlar reset qilindi"
 *                 data:
 *                   type: object
 *                   properties:
 *                     selectChecksDeleted:
 *                       type: integer
 *                       example: 150
 *                     checksReset:
 *                       type: integer
 *                       example: 200
 *                     fakturasReset:
 *                       type: integer
 *                       example: 50
 *       401:
 *         description: Autentifikatsiya talab qilinadi
 */
router.post('/reset', authMiddleware, controller.reset.bind(controller));

/**
 * @swagger
 * /api/select_checks/preview:
 *   get:
 *     summary: 👁️ Generate preview
 *     description: |
 *       Generate qilishdan oldin qancha faktura va chek moslanishi mumkinligini ko'rsatadi.
 *       Faqat birinchi 10 ta faktura uchun preview beradi.
 *     tags: [SelectChecks]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Preview ma'lumotlari
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
 *                     total_fakturas:
 *                       type: integer
 *                       example: 50
 *                     preview:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           faktura_id:
 *                             type: integer
 *                           mxik:
 *                             type: string
 *                           faktura_summa:
 *                             type: number
 *                           faktura_sana:
 *                             type: string
 *                           available_checks:
 *                             type: integer
 *                           max_summa:
 *                             type: number
 */
router.get('/preview', authMiddleware, controller.getPreview.bind(controller));

// =============================================
// 🤖 AUTOMATION
// =============================================

/**
 * @swagger
 * /api/select_checks/automation/process:
 *   post:
 *     summary: 🤖 Select checks'larni UI orqali avtomatik qayta ishlash
 *     description: |
 *       **Bu endpoint:**
 *       1. Browser ochadi (Playwright)
 *       2. Soliq.uz saytiga kiradi
 *       3. Login bo'lishni kutadi (5 daqiqa)
 *       4. Select_checks jadvalidan "pending" holatdagi ma'lumotlarni oladi
 *       5. Har bir chekni avtomatik ravishda UI orqali qayta ishlaydi:
 *          - Chekni qidiradi
 *          - "Batafsil" tugmasini bosadi
 *          - "Tahrirlash" tugmasini bosadi
 *          - MXIK, o'lchov, miqdor, summa maydonlarini to'ldiradi
 *          - CAPTCHA ni yechadi (2Captcha API orqali)
 *          - "Saqlash" tugmasini bosadi
 *       6. Natijalarni qaytaradi
 *
 *       **Muhim:**
 *       - Browser ochilgandan so'ng, foydalanuvchi qo'lda login qilishi kerak
 *       - Maksimal 100 ta select_check bir vaqtning o'zida qayta ishlanadi
 *       - Har bir chek uchun 3 marta qayta urinish amalga oshiriladi (CAPTCHA xatosi bo'lsa)
 *     tags: [SelectChecks]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - captchaApiKey
 *             properties:
 *               captchaApiKey:
 *                 type: string
 *                 description: 2Captcha API key
 *                 example: "your_2captcha_api_key_here"
 *               headless:
 *                 type: boolean
 *                 description: Browser headless rejimida ishlatilsinmi
 *                 default: false
 *     responses:
 *       200:
 *         description: Automation jarayoni yakunlandi
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
 *                   example: "Automation jarayoni yakunlandi"
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Jami qayta ishlangan cheklar
 *                       example: 50
 *                     success:
 *                       type: integer
 *                       description: Muvaffaqiyatli qayta ishlangan cheklar
 *                       example: 45
 *                     failed:
 *                       type: integer
 *                       description: Xato bilan yakunlangan cheklar
 *                       example: 5
 *       400:
 *         description: CAPTCHA API key kiritilmagan
 *       401:
 *         description: Autentifikatsiya talab qilinadi
 *       500:
 *         description: Automation xatosi
 */
router.post(
  '/automation/process',
  authMiddleware,
  controller.processWithAutomation.bind(controller),
);

// =============================================
// STATISTIKA
// =============================================

/**
 * @swagger
 * /api/select_checks/stats:
 *   get:
 *     summary: Statistika
 *     description: SelectChecks bo'yicha umumiy statistika
 *     tags: [SelectChecks]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistika ma'lumotlari
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
 *                     total:
 *                       type: integer
 *                       example: 150
 *                     active:
 *                       type: integer
 *                       example: 45
 *                     processed:
 *                       type: integer
 *                       example: 100
 *                     pending:
 *                       type: integer
 *                       example: 30
 *                     failed:
 *                       type: integer
 *                       example: 5
 *                     totalSum:
 *                       type: number
 *                       example: 15000000
 *                     totalFakturaSum:
 *                       type: number
 *                       example: 14500000
 *                     byStatus:
 *                       type: object
 *                       example:
 *                         pending: 30
 *                         processing: 15
 *                         completed: 100
 *                         failed: 5
 */
router.get('/stats', authMiddleware, controller.getStatistics.bind(controller));

// =============================================
// CRUD ENDPOINTS
// =============================================

/**
 * @swagger
 * /api/select_checks:
 *   get:
 *     summary: Barcha select_checks'larni olish
 *     description: Pagination, filtering va sorting bilan
 *     tags: [SelectChecks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: processed
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: automationStatus
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: SelectChecks ro'yxati
 */
router.get('/', authMiddleware, controller.getAll.bind(controller));

/**
 * @swagger
 * /api/select_checks/{id}:
 *   get:
 *     summary: Bitta select_check'ni olish
 *     tags: [SelectChecks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: SelectCheck ma'lumotlari
 *       404:
 *         description: Topilmadi
 */
router.get('/:id', authMiddleware, controller.getById.bind(controller));

/**
 * @swagger
 * /api/select_checks:
 *   post:
 *     summary: Yangi select_check yaratish
 *     tags: [SelectChecks]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SelectCheckCreate'
 *     responses:
 *       201:
 *         description: Yaratildi
 */
router.post('/', authMiddleware, controller.create.bind(controller));

/**
 * @swagger
 * /api/select_checks/{id}:
 *   put:
 *     summary: Select_check'ni yangilash
 *     tags: [SelectChecks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SelectCheckUpdate'
 *     responses:
 *       200:
 *         description: Yangilandi
 */
router.put('/:id', authMiddleware, controller.update.bind(controller));

/**
 * @swagger
 * /api/select_checks/{id}:
 *   delete:
 *     summary: Select_check'ni o'chirish
 *     tags: [SelectChecks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: O'chirildi
 */
router.delete('/:id', authMiddleware, controller.delete.bind(controller));

// =============================================
// BULK OPERATIONS
// =============================================

/**
 * @swagger
 * /api/select_checks/bulk/delete:
 *   post:
 *     summary: Ko'p select_check'larni o'chirish
 *     tags: [SelectChecks]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: O'chirildi
 */
router.post(
  '/bulk/delete',
  authMiddleware,
  controller.bulkDelete.bind(controller),
);

/**
 * @swagger
 * /api/select_checks/bulk/update-status:
 *   post:
 *     summary: Ko'p select_check'larning holatini yangilash
 *     tags: [SelectChecks]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *               automationStatus:
 *                 type: string
 *                 enum: [pending, processing, completed, failed]
 *     responses:
 *       200:
 *         description: Yangilandi
 */
router.post(
  '/bulk/update-status',
  authMiddleware,
  controller.bulkUpdateStatus.bind(controller),
);

// =============================================
// STATUS OPERATIONS
// =============================================

/**
 * @swagger
 * /api/select_checks/{id}/toggle-active:
 *   patch:
 *     summary: isActive'ni o'zgartirish
 *     tags: [SelectChecks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: O'zgartirildi
 */
router.patch(
  '/:id/toggle-active',
  authMiddleware,
  controller.toggleActive.bind(controller),
);

/**
 * @swagger
 * /api/select_checks/{id}/mark-processed:
 *   patch:
 *     summary: Processed qilish
 *     tags: [SelectChecks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Processed qilindi
 */
router.patch(
  '/:id/mark-processed',
  authMiddleware,
  controller.markAsProcessed.bind(controller),
);

/**
 * @swagger
 * /api/select_checks/{id}/mark-ready:
 *   patch:
 *     summary: Automation uchun tayyor qilish
 *     tags: [SelectChecks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tayyor qilindi
 *       400:
 *         description: Maydonlar to'ldirilmagan
 */
router.patch(
  '/:id/mark-ready',
  authMiddleware,
  controller.markAsReadyForProcessing.bind(controller),
);

// =============================================
// SWAGGER SCHEMAS
// =============================================

/**
 * @swagger
 * components:
 *   schemas:
 *     SelectCheck:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         uuid:
 *           type: string
 *           format: uuid
 *         creationDataFaktura:
 *           type: string
 *         mxik:
 *           type: string
 *         ulchov:
 *           type: string
 *         fakturaSumma:
 *           type: number
 *         fakturaMiqdor:
 *           type: number
 *         chekRaqam:
 *           type: string
 *         maxsulotNomi:
 *           type: string
 *         chekSumma:
 *           type: number
 *         miqdor:
 *           type: number
 *         umumiyChekSumma:
 *           type: number
 *         birBirlik:
 *           type: number
 *         isActive:
 *           type: boolean
 *         processed:
 *           type: boolean
 *         automationStatus:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         errorMessage:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     SelectCheckCreate:
 *       type: object
 *       required:
 *         - creationDataFaktura
 *         - mxik
 *         - ulchov
 *         - fakturaSumma
 *         - fakturaMiqdor
 *         - chekRaqam
 *         - maxsulotNomi
 *         - chekSumma
 *         - miqdor
 *         - umumiyChekSumma
 *       properties:
 *         creationDataFaktura:
 *           type: string
 *         mxik:
 *           type: string
 *         ulchov:
 *           type: string
 *         fakturaSumma:
 *           type: number
 *         fakturaMiqdor:
 *           type: number
 *         chekRaqam:
 *           type: string
 *         maxsulotNomi:
 *           type: string
 *         chekSumma:
 *           type: number
 *         miqdor:
 *           type: number
 *         umumiyChekSumma:
 *           type: number
 *
 *     SelectCheckUpdate:
 *       type: object
 *       properties:
 *         mxik:
 *           type: string
 *         ulchov:
 *           type: string
 *         fakturaSumma:
 *           type: number
 *         fakturaMiqdor:
 *           type: number
 *         chekRaqam:
 *           type: string
 *         maxsulotNomi:
 *           type: string
 *         chekSumma:
 *           type: number
 *         miqdor:
 *           type: number
 *         isActive:
 *           type: boolean
 *         processed:
 *           type: boolean
 *         automationStatus:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 */

export default router;
