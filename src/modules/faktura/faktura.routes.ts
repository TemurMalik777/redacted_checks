// src/modules/faktura/faktura.routes.ts

import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { generalLimiter } from '../../middlewares/rateLimiterMiddleware';
import fakturaController from './faktura.controller';

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
 * /api/faktura/stats:
 *   get:
 *     summary: Faktura statistikasi
 *     description: Fakturalar bo'yicha umumiy statistika
 *     tags: [Faktura]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistika
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/stats', fakturaController.getStats);

/**
 * ========================================
 * IMPORT OPERATSIYALARI
 * ========================================
 */

/**
 * @swagger
 * /api/faktura/import:
 *   post:
 *     summary: Excel fayldan fakturalar import qilish
 *     description: Faktura ma'lumotlarini Excel dan import qilish
 *     tags: [Faktura]
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
 *       400:
 *         description: Fayl yuklanmadi
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/import',
  fakturaController.uploadMiddleware,
  fakturaController.importFromExcel
);

/**
 * ========================================
 * BULK OPERATSIYALAR
 * ========================================
 */

/**
 * @swagger
 * /api/faktura/bulk/delete:
 *   post:
 *     summary: Ko'plab fakturalarni o'chirish
 *     description: Bir nechta fakturalarni bir vaqtda o'chirish
 *     tags: [Faktura]
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
 *         description: Fakturalar o'chirildi
 *       400:
 *         description: IDs array bo'sh
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/bulk/delete', fakturaController.bulkDeleteFakturas);

/**
 * ========================================
 * CRUD OPERATSIYALAR
 * ========================================
 */

/**
 * @swagger
 * /api/faktura:
 *   get:
 *     summary: Barcha fakturalar ro'yxati
 *     description: Pagination va filter bilan fakturalar ro'yxatini olish
 *     tags: [Faktura]
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
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Aktiv fakturalar
 *       - in: query
 *         name: mxik
 *         schema:
 *           type: string
 *         description: MXIK kodi bo'yicha qidirish
 *     responses:
 *       200:
 *         description: Fakturalar ro'yxati
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', fakturaController.getAllFakturas);

/**
 * @swagger
 * /api/faktura/{id}:
 *   get:
 *     summary: Bitta fakturani olish
 *     description: ID bo'yicha faktura ma'lumotlarini olish
 *     tags: [Faktura]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Faktura ID
 *     responses:
 *       200:
 *         description: Faktura ma'lumotlari
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:id', fakturaController.getFakturaById);

/**
 * @swagger
 * /api/faktura/{id}:
 *   put:
 *     summary: Fakturani tahrirlash
 *     description: Mavjud faktura ma'lumotlarini yangilash
 *     tags: [Faktura]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Faktura ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               creation_data_faktura:
 *                 type: string
 *               mxik:
 *                 type: string
 *               ulchov:
 *                 type: string
 *               fakturaSumma:
 *                 type: number
 *               fakturaMiqdor:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Faktura tahrirlandi
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/:id', fakturaController.updateFaktura);

/**
 * @swagger
 * /api/faktura/{id}:
 *   delete:
 *     summary: Fakturani o'chirish
 *     description: Faktura ni deaktiv qilish (soft delete)
 *     tags: [Faktura]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Faktura ID
 *     responses:
 *       200:
 *         description: Faktura o'chirildi
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/:id', fakturaController.deleteFaktura);

export default router;