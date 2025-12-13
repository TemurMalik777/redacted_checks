import { Router } from 'express';
import { SelectChecksController } from './selectChecks.controller';
import { authMiddleware } from '../../middlewares/authMiddleware';

const router = Router();
const controller = new SelectChecksController();

/**
 * @swagger
 * tags:
 *   name: SelectChecks
 *   description: Select Checks CRUD API'lari
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SelectCheck:
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
 *         - birBirlik
 *       properties:
 *         id:
 *           type: integer
 *           description: SelectCheck ID
 *           example: 1
 *         uuid:
 *           type: string
 *           format: uuid
 *           description: UUID
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         creationDataFaktura:
 *           type: string
 *           description: Faktura yaratilgan sana
 *           example: "2024-12-01"
 *         mxik:
 *           type: string
 *           description: MXIK kod
 *           example: "10201001001000000"
 *         ulchov:
 *           type: string
 *           description: O'lchov birligi
 *           example: "dona"
 *         fakturaSumma:
 *           type: number
 *           format: decimal
 *           description: Faktura summasi
 *           example: 50000.00
 *         fakturaMiqdor:
 *           type: number
 *           format: decimal
 *           description: Faktura miqdori
 *           example: 5.000
 *         chekRaqam:
 *           type: string
 *           description: Check raqami
 *           example: "CHK-2024-001"
 *         maxsulotNomi:
 *           type: string
 *           description: Maxsulot nomi
 *           example: "Olma"
 *         chekSumma:
 *           type: number
 *           format: decimal
 *           description: Check summasi
 *           example: 10000.00
 *         miqdor:
 *           type: number
 *           format: decimal
 *           description: Miqdor
 *           example: 1.000
 *         umumiyChekSumma:
 *           type: number
 *           format: decimal
 *           description: Umumiy check summasi
 *           example: 10000.00
 *         birBirlik:
 *           type: number
 *           format: decimal
 *           description: Bir birlik narxi (avtomatik hisoblanadi)
 *           example: 10000.00
 *         isActive:
 *           type: boolean
 *           description: Faolmi
 *           example: false
 *         processed:
 *           type: boolean
 *           description: Qayta ishlanganmi
 *           example: false
 *         automationStatus:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *           description: Automation holati
 *           example: "pending"
 *         errorMessage:
 *           type: string
 *           description: Xato xabari
 *           example: null
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     SelectCheckResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Muvaffaqiyatli"
 *         data:
 *           oneOf:
 *             - $ref: '#/components/schemas/SelectCheck'
 *             - type: array
 *               items:
 *                 $ref: '#/components/schemas/SelectCheck'
 *         meta:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *             page:
 *               type: integer
 *             limit:
 *               type: integer
 *             totalPages:
 *               type: integer
 */

/**
 * @swagger
 * /api/select-checks:
 *   get:
 *     summary: Barcha select_checks'larni olish
 *     description: Pagination, filtering va sorting bilan barcha select_checks'larni olish
 *     tags: [SelectChecks]
 *     security:
 *       - bearerAuth: []
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
 *         description: Sahifadagi elementlar soni
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: isActive bo'yicha filtrlash
 *       - in: query
 *         name: processed
 *         schema:
 *           type: boolean
 *         description: processed bo'yicha filtrlash
 *       - in: query
 *         name: automationStatus
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         description: automationStatus bo'yicha filtrlash
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Qidiruv (maxsulotNomi, chekRaqam, mxik)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Tartiblash maydoni
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Tartiblash yo'nalishi
 *     responses:
 *       200:
 *         description: SelectChecks ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SelectCheckResponse'
 *             example:
 *               success: true
 *               message: "Select checks muvaffaqiyatli olindi"
 *               data:
 *                 - id: 1
 *                   uuid: "550e8400-e29b-41d4-a716-446655440000"
 *                   creationDataFaktura: "2024-12-01"
 *                   mxik: "10201001001000000"
 *                   ulchov: "dona"
 *                   fakturaSumma: 50000
 *                   fakturaMiqdor: 5
 *                   chekRaqam: "CHK-2024-001"
 *                   maxsulotNomi: "Olma"
 *                   chekSumma: 10000
 *                   miqdor: 1
 *                   umumiyChekSumma: 10000
 *                   birBirlik: 10000
 *                   isActive: false
 *                   processed: false
 *                   automationStatus: "pending"
 *               meta:
 *                 total: 150
 *                 page: 1
 *                 limit: 20
 *                 totalPages: 8
 *       401:
 *         description: Autentifikatsiya talab qilinadi
 */
router.get('/', authMiddleware, controller.getAll);

/**
 * @swagger
 * /api/select-checks/stats:
 *   get:
 *     summary: Statistika
 *     description: SelectChecks bo'yicha umumiy statistika
 *     tags: [SelectChecks]
 *     security:
 *       - bearerAuth: []
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
 *                     byStatus:
 *                       type: object
 *                       example:
 *                         pending: 30
 *                         processing: 15
 *                         completed: 100
 *                         failed: 5
 *       401:
 *         description: Autentifikatsiya talab qilinadi
 */
router.get('/stats', authMiddleware, controller.getStatistics);

/**
 * @swagger
 * /api/select-checks/{id}:
 *   get:
 *     summary: Bitta select_check'ni olish
 *     description: ID orqali bitta select_check ma'lumotlarini olish
 *     tags: [SelectChecks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: SelectCheck ID
 *     responses:
 *       200:
 *         description: SelectCheck ma'lumotlari
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SelectCheckResponse'
 *       404:
 *         description: SelectCheck topilmadi
 *       401:
 *         description: Autentifikatsiya talab qilinadi
 */
router.get('/:id', authMiddleware, controller.getById);

/**
 * @swagger
 * /api/select-checks:
 *   post:
 *     summary: Yangi select_check yaratish
 *     description: Yangi select_check yozuvini yaratish
 *     tags: [SelectChecks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - creationDataFaktura
 *               - mxik
 *               - ulchov
 *               - fakturaSumma
 *               - fakturaMiqdor
 *               - chekRaqam
 *               - maxsulotNomi
 *               - chekSumma
 *               - miqdor
 *               - umumiyChekSumma
 *             properties:
 *               creationDataFaktura:
 *                 type: string
 *                 example: "2024-12-01"
 *               mxik:
 *                 type: string
 *                 example: "10201001001000000"
 *               ulchov:
 *                 type: string
 *                 example: "dona"
 *               fakturaSumma:
 *                 type: number
 *                 example: 50000
 *               fakturaMiqdor:
 *                 type: number
 *                 example: 5
 *               chekRaqam:
 *                 type: string
 *                 example: "CHK-2024-001"
 *               maxsulotNomi:
 *                 type: string
 *                 example: "Olma"
 *               chekSumma:
 *                 type: number
 *                 example: 10000
 *               miqdor:
 *                 type: number
 *                 example: 1
 *               umumiyChekSumma:
 *                 type: number
 *                 example: 10000
 *     responses:
 *       201:
 *         description: SelectCheck yaratildi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SelectCheckResponse'
 *       400:
 *         description: Noto'g'ri ma'lumot
 *       401:
 *         description: Autentifikatsiya talab qilinadi
 */
router.post('/', authMiddleware, controller.create);

/**
 * @swagger
 * /api/select-checks/{id}:
 *   put:
 *     summary: Select_check'ni yangilash
 *     description: Mavjud select_check'ni to'liq yangilash
 *     tags: [SelectChecks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: SelectCheck ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               creationDataFaktura:
 *                 type: string
 *               mxik:
 *                 type: string
 *               ulchov:
 *                 type: string
 *               fakturaSumma:
 *                 type: number
 *               fakturaMiqdor:
 *                 type: number
 *               chekRaqam:
 *                 type: string
 *               maxsulotNomi:
 *                 type: string
 *               chekSumma:
 *                 type: number
 *               miqdor:
 *                 type: number
 *               umumiyChekSumma:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *               processed:
 *                 type: boolean
 *               automationStatus:
 *                 type: string
 *                 enum: [pending, processing, completed, failed]
 *               errorMessage:
 *                 type: string
 *           example:
 *             automationStatus: "completed"
 *             processed: true
 *     responses:
 *       200:
 *         description: SelectCheck yangilandi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SelectCheckResponse'
 *       404:
 *         description: SelectCheck topilmadi
 *       401:
 *         description: Autentifikatsiya talab qilinadi
 */
router.put('/:id', authMiddleware, controller.update);

/**
 * @swagger
 * /api/select-checks/{id}:
 *   delete:
 *     summary: Select_check'ni o'chirish
 *     description: Select_check'ni bazadan o'chirish
 *     tags: [SelectChecks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: SelectCheck ID
 *     responses:
 *       200:
 *         description: SelectCheck o'chirildi
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
 *                   example: "SelectCheck o'chirildi"
 *       404:
 *         description: SelectCheck topilmadi
 *       401:
 *         description: Autentifikatsiya talab qilinadi
 */
router.delete('/:id', authMiddleware, controller.delete);

/**
 * @swagger
 * /api/select-checks/bulk/delete:
 *   post:
 *     summary: Ko'p select_check'larni o'chirish
 *     description: Bir nechta select_check'larni bir vaqtda o'chirish
 *     tags: [SelectChecks]
 *     security:
 *       - bearerAuth: []
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
 *         description: SelectCheck'lar o'chirildi
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
 *                     deletedCount:
 *                       type: integer
 *                       example: 5
 *                     message:
 *                       type: string
 *                       example: "5 ta select_check o'chirildi"
 *       401:
 *         description: Autentifikatsiya talab qilinadi
 */
router.post('/bulk/delete', authMiddleware, controller.bulkDelete);

/**
 * @swagger
 * /api/select-checks/bulk/update-status:
 *   post:
 *     summary: Ko'p select_check'larning holatini yangilash
 *     description: Bir nechta select_check'larning automationStatus'ini yangilash
 *     tags: [SelectChecks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *               - automationStatus
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 2, 3]
 *               automationStatus:
 *                 type: string
 *                 enum: [pending, processing, completed, failed]
 *                 example: "completed"
 *     responses:
 *       200:
 *         description: Holatlar yangilandi
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
 *                     updatedCount:
 *                       type: integer
 *                       example: 3
 *                     message:
 *                       type: string
 *                       example: "3 ta select_check holati yangilandi"
 *       401:
 *         description: Autentifikatsiya talab qilinadi
 */
router.post('/bulk/update-status', authMiddleware, controller.bulkUpdateStatus);

/**
 * @swagger
 * /api/select-checks/{id}/toggle-active:
 *   patch:
 *     summary: isActive'ni o'zgartirish
 *     description: SelectCheck'ning isActive holatini toggle qilish
 *     tags: [SelectChecks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: isActive o'zgartirildi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SelectCheckResponse'
 *       401:
 *         description: Autentifikatsiya talab qilinadi
 */
router.patch('/:id/toggle-active', authMiddleware, controller.toggleActive);

/**
 * @swagger
 * /api/select-checks/{id}/mark-processed:
 *   patch:
 *     summary: Processed qilish
 *     description: SelectCheck'ni processed = true qilish
 *     tags: [SelectChecks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Processed qilindi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SelectCheckResponse'
 *       401:
 *         description: Autentifikatsiya talab qilinadi
 */
router.patch('/:id/mark-processed', authMiddleware, controller.markAsProcessed);

export default router;