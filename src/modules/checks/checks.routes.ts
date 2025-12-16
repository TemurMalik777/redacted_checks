import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { generalLimiter } from '../../middlewares/rateLimiterMiddleware';
import checksController from './checks.controller';


const router = Router();

// Barcha route'lar himoyalangan
router.use(authMiddleware, generalLimiter);

/**
 * ========================================
 * STATISTIKA VA UMUMIY MA'LUMOTLAR
 * ========================================
 */

/**
 * @swagger
 * /api/checks/stats:
 *   get:
 *     summary: Checklar statistikasi
 *     description: Umumiy, processed va unprocessed checklar statistikasi
 *     tags: [Checks]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistika muvaffaqiyatli olindi
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
 *                     processed:
 *                       type: integer
 *                       example: 100
 *                     unprocessed:
 *                       type: integer
 *                       example: 50
 *                     totalSumma:
 *                       type: number
 *                       example: 15000000.00
 *                     processedSumma:
 *                       type: number
 *                       example: 10000000.00
 *                     unprocessedSumma:
 *                       type: number
 *                       example: 5000000.00
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/stats', checksController.getStats);

/**
 * ========================================
 * IMPORT OPERATSIYALARI
 * ========================================
 */

/**
 * @swagger
 * /api/checks/import:
 *   post:
 *     summary: Excel fayldan checklar import qilish
 *     description: data_faktura_checks.xlsx faylidan checklar import qilish
 *     tags: [Checks]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel fayl (.xlsx yoki .xls)
 *               importId:
 *                 type: integer
 *                 description: Import operatsiyasi ID (ixtiyoriy)
 *     responses:
 *       200:
 *         description: Import muvaffaqiyatli yakunlandi
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
 *                   example: Import muvaffaqiyatli yakunlandi
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 100
 *                     imported:
 *                       type: integer
 *                       example: 95
 *                     failed:
 *                       type: integer
 *                       example: 3
 *                     skipped:
 *                       type: integer
 *                       example: 2
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           row:
 *                             type: integer
 *                           message:
 *                             type: string
 *                           data:
 *                             type: object
 *       400:
 *         description: Validatsiya xatosi yoki fayl yuklanmadi
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/import',
  checksController.uploadMiddleware,
  checksController.importFromExcel
);

/**
 * ========================================
 * BULK OPERATSIYALAR
 * ========================================
 */

/**
 * @swagger
 * /api/checks/bulk/delete:
 *   post:
 *     summary: Ko'plab checklarni o'chirish
 *     description: Bir nechta checklarni bir vaqtda o'chirish (faqat unprocessed)
 *     tags: [Checks]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 2, 3, 4, 5]
 *     responses:
 *       200:
 *         description: Checklar o'chirildi
 *       400:
 *         description: IDs array bo'sh yoki noto'g'ri
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/bulk/delete', checksController.bulkDeleteChecks);

/**
 * @swagger
 * /api/checks/bulk/mark-processed:
 *   post:
 *     summary: Ko'plab checklarni processed qilish
 *     description: Bir nechta checklarni processed=true qilish
 *     tags: [Checks]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 2, 3]
 *     responses:
 *       200:
 *         description: Checklar processed qilindi
 *       400:
 *         description: IDs array bo'sh
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/bulk/mark-processed', checksController.markAsProcessed);

/**
 * @swagger
 * /api/checks/bulk/mark-unprocessed:
 *   post:
 *     summary: Ko'plab checklarni unprocessed qilish
 *     description: Bir nechta checklarni processed=false qilish
 *     tags: [Checks]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 2, 3]
 *     responses:
 *       200:
 *         description: Checklar unprocessed qilindi
 *       400:
 *         description: IDs array bo'sh
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/bulk/mark-unprocessed', checksController.markAsUnprocessed);

/**
 * ========================================
 * CRUD OPERATSIYALAR
 * ========================================
 */

/**
 * @swagger
 * /api/checks:
 *   get:
 *     summary: Barcha checklar ro'yxati
 *     description: Pagination, search va filter bilan checklar ro'yxatini olish
 *     tags: [Checks]
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
 *         description: Har sahifada nechta element
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Qidiruv (chek_raqam yoki maxsulot_nomi bo'yicha)
 *       - in: query
 *         name: processed
 *         schema:
 *           type: boolean
 *         description: Processed filtri (true/false)
 *       - in: query
 *         name: importId
 *         schema:
 *           type: integer
 *         description: Import ID bo'yicha filtrlash
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Boshlanish sanasi (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Tugash sanasi (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Checklar ro'yxati
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
 *                     checks:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Check'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', checksController.getAllChecks);

/**
 * @swagger
 * /api/checks:
 *   post:
 *     summary: Yangi check yaratish
 *     description: Check ma'lumotlarini qo'lda kiritish va yaratish
 *     tags: [Checks]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - creation_date_check
 *               - chekRaqam
 *               - chekSumma
 *               - maxsulotNomi
 *             properties:
 *               creation_date_check:
 *                 type: string
 *                 example: '2024-12-11'
 *                 description: Check yaratilgan sana
 *               chekRaqam:
 *                 type: string
 *                 example: 'CHK-12345'
 *                 description: Check raqami (unique)
 *               chekSumma:
 *                 type: number
 *                 format: decimal
 *                 example: 1500000.00
 *                 description: Check summasi
 *               maxsulotNomi:
 *                 type: string
 *                 example: 'Aspirin 500mg'
 *                 description: Maxsulot nomi
 *     responses:
 *       201:
 *         description: Check yaratildi
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
 *                   example: Check muvaffaqiyatli yaratildi
 *                 data:
 *                   type: object
 *                   properties:
 *                     check:
 *                       $ref: '#/components/schemas/Check'
 *       400:
 *         description: Validatsiya xatosi yoki dublikat chek raqam
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/', checksController.createCheck);

/**
 * @swagger
 * /api/checks/search:
 *   get:
 *     summary: Chek raqam bo'yicha qidirish
 *     description: Aniq chek raqam bo'yicha checkni topish
 *     tags: [Checks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: chekRaqam
 *         required: true
 *         schema:
 *           type: string
 *         description: Qidirilayotgan chek raqam
 *     responses:
 *       200:
 *         description: Check topildi yoki topilmadi
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
 *                     check:
 *                       $ref: '#/components/schemas/Check'
 *       400:
 *         description: chekRaqam parameter kiritilmagan
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/search', checksController.searchByChekRaqam);

/**
 * @swagger
 * /api/checks/{id}:
 *   get:
 *     summary: Bitta checkni olish
 *     description: ID bo'yicha check ma'lumotlarini olish
 *     tags: [Checks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Check ID
 *     responses:
 *       200:
 *         description: Check ma'lumotlari
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
 *                     check:
 *                       $ref: '#/components/schemas/Check'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:id', checksController.getCheckById);

/**
 * @swagger
 * /api/checks/{id}:
 *   put:
 *     summary: Checkni tahrirlash
 *     description: Mavjud check ma'lumotlarini yangilash
 *     tags: [Checks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Check ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               creation_date_check:
 *                 type: string
 *                 example: '2024-12-11'
 *               chekRaqam:
 *                 type: string
 *                 example: 'CHK-12345'
 *               chekSumma:
 *                 type: number
 *                 example: 1500000.00
 *               maxsulotNomi:
 *                 type: string
 *                 example: 'Aspirin 500mg'
 *               processed:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Check tahrirlandi
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
 *                   example: Check muvaffaqiyatli tahrirlandi
 *                 data:
 *                   type: object
 *                   properties:
 *                     check:
 *                       $ref: '#/components/schemas/Check'
 *       400:
 *         description: Validatsiya xatosi yoki dublikat chek raqam
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/:id', checksController.updateCheck);

/**
 * @swagger
 * /api/checks/{id}:
 *   delete:
 *     summary: Checkni o'chirish
 *     description: Check ni o'chirish (faqat unprocessed checklar)
 *     tags: [Checks]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Check ID
 *     responses:
 *       200:
 *         description: Check o'chirildi
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
 *                   example: Check muvaffaqiyatli o'chirildi
 *       400:
 *         description: Processed checkni o'chirish mumkin emas
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/:id', checksController.deleteCheck);

export default router;