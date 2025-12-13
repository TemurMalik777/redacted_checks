import { Router } from 'express';
import { ImportController } from './import.controller';
import { authMiddleware } from '../../middlewares/authMiddleware';

const router = Router();
const controller = new ImportController();

/**
 * @swagger
 * tags:
 *   name: Import
 *   description: Import CRUD va management API'lari
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Import:
 *       type: object
 *       required:
 *         - fileName
 *         - source
 *         - totalRows
 *         - importedBy
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         uuid:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         fileName:
 *           type: string
 *           example: "data_2024_12.xlsx"
 *         isActive:
 *           type: boolean
 *           example: true
 *         processed:
 *           type: boolean
 *           example: false
 *         source:
 *           type: string
 *           enum: [excel, manual]
 *           example: "excel"
 *         totalRows:
 *           type: integer
 *           example: 150
 *         importedRows:
 *           type: integer
 *           example: 145
 *         failedRows:
 *           type: integer
 *           example: 5
 *         status:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *           example: "completed"
 *         errorMessage:
 *           type: string
 *           example: null
 *         importedBy:
 *           type: integer
 *           example: 123
 *         startedAt:
 *           type: string
 *           format: date-time
 *         finishedAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     ImportResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           oneOf:
 *             - $ref: '#/components/schemas/Import'
 *             - type: array
 *               items:
 *                 $ref: '#/components/schemas/Import'
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
 * /api/import:
 *   get:
 *     summary: Barcha import'larni olish
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [excel, manual]
 *       - in: query
 *         name: importedBy
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: fileName yoki errorMessage bo'yicha qidiruv
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
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Import'lar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImportResponse'
 */
router.get('/', authMiddleware, controller.getAll);

/**
 * @swagger
 * /api/import/stats:
 *   get:
 *     summary: Umumiy statistika
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: Muayyan user uchun statistika
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     processed:
 *                       type: integer
 *                     pending:
 *                       type: integer
 *                     failed:
 *                       type: integer
 *                     totalRowsImported:
 *                       type: integer
 *                     totalRowsFailed:
 *                       type: integer
 *                     avgSuccessRate:
 *                       type: number
 *                     byStatus:
 *                       type: object
 *                     bySource:
 *                       type: object
 */
router.get('/stats', authMiddleware, controller.getStatistics);

/**
 * @swagger
 * /api/import/active:
 *   get:
 *     summary: Active import'lar (processing holatda)
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Active import'lar
 */
router.get('/active', authMiddleware, controller.getActiveImports);

/**
 * @swagger
 * /api/import/pending:
 *   get:
 *     summary: Pending import'lar
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Pending import'lar
 */
router.get('/pending', authMiddleware, controller.getPendingImports);

/**
 * @swagger
 * /api/import/failed:
 *   get:
 *     summary: Failed import'lar
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Failed import'lar
 */
router.get('/failed', authMiddleware, controller.getFailedImports);

/**
 * @swagger
 * /api/import/recent:
 *   get:
 *     summary: Oxirgi import'lar
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Oxirgi import'lar
 */
router.get('/recent', authMiddleware, controller.getRecent);

/**
 * @swagger
 * /api/import/{id}:
 *   get:
 *     summary: Bitta import'ni olish
 *     tags: [Import]
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
 *         description: Import ma'lumotlari
 *       404:
 *         description: Import topilmadi
 */
router.get('/:id', authMiddleware, controller.getById);

/**
 * @swagger
 * /api/import:
 *   post:
 *     summary: Yangi import yaratish
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileName
 *               - source
 *               - totalRows
 *               - importedBy
 *             properties:
 *               fileName:
 *                 type: string
 *                 example: "data_2024_12.xlsx"
 *               source:
 *                 type: string
 *                 enum: [excel, manual]
 *                 example: "excel"
 *               totalRows:
 *                 type: integer
 *                 example: 150
 *               importedBy:
 *                 type: integer
 *                 example: 123
 *     responses:
 *       201:
 *         description: Import yaratildi
 */
router.post('/', authMiddleware, controller.create);

/**
 * @swagger
 * /api/import/{id}:
 *   put:
 *     summary: Import'ni yangilash
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
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
 *             type: object
 *             properties:
 *               fileName:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, processing, completed, failed]
 *               errorMessage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Import yangilandi
 */
router.put('/:id', authMiddleware, controller.update);

/**
 * @swagger
 * /api/import/{id}:
 *   delete:
 *     summary: Import'ni o'chirish
 *     tags: [Import]
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
 *         description: Import o'chirildi
 */
router.delete('/:id', authMiddleware, controller.delete);

/**
 * @swagger
 * /api/import/bulk/delete:
 *   post:
 *     summary: Ko'p import'larni o'chirish
 *     tags: [Import]
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
 *                 example: [1, 2, 3]
 *     responses:
 *       200:
 *         description: Import'lar o'chirildi
 */
router.post('/bulk/delete', authMiddleware, controller.bulkDelete);

/**
 * @swagger
 * /api/import/{id}/start:
 *   post:
 *     summary: Import'ni boshlash
 *     tags: [Import]
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
 *         description: Import boshlandi
 */
router.post('/:id/start', authMiddleware, controller.startImport);

/**
 * @swagger
 * /api/import/{id}/complete:
 *   post:
 *     summary: Import'ni tugallash
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
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
 *             type: object
 *             required:
 *               - importedRows
 *               - failedRows
 *             properties:
 *               importedRows:
 *                 type: integer
 *                 example: 145
 *               failedRows:
 *                 type: integer
 *                 example: 5
 *               errorMessage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Import tugallandi
 */
router.post('/:id/complete', authMiddleware, controller.completeImport);

/**
 * @swagger
 * /api/import/{id}/fail:
 *   post:
 *     summary: Import'ni xato bilan tugallash
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
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
 *             type: object
 *             required:
 *               - errorMessage
 *             properties:
 *               errorMessage:
 *                 type: string
 *                 example: "Excel fayl buzilgan"
 *     responses:
 *       200:
 *         description: Import xato bilan tugallandi
 */
router.post('/:id/fail', authMiddleware, controller.failImport);

/**
 * @swagger
 * /api/import/{id}/retry:
 *   post:
 *     summary: Failed import'ni qayta boshlash
 *     tags: [Import]
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
 *         description: Import qayta boshlandi
 */
router.post('/:id/retry', authMiddleware, controller.retryImport);

/**
 * @swagger
 * /api/import/{id}/cancel:
 *   post:
 *     summary: Import'ni bekor qilish
 *     tags: [Import]
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
 *         description: Import bekor qilindi
 */
router.post('/:id/cancel', authMiddleware, controller.cancelImport);

/**
 * @swagger
 * /api/import/{id}/toggle-active:
 *   patch:
 *     summary: isActive'ni o'zgartirish
 *     tags: [Import]
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
 */
router.patch('/:id/toggle-active', authMiddleware, controller.toggleActive);

/**
 * @swagger
 * /api/import/user/{userId}:
 *   get:
 *     summary: User'ning import'larini olish
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: User'ning import'lari
 */
router.get('/user/:userId', authMiddleware, controller.getByUser);

/**
 * @swagger
 * /api/import/stats/user/{userId}:
 *   get:
 *     summary: User statistikasi
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User statistikasi
 */
router.get('/stats/user/:userId', authMiddleware, controller.getUserStatistics);

export default router;