import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { generalLimiter } from '../../middlewares/rateLimiterMiddleware';

const router = Router();

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
 *         name: processed
 *         schema:
 *           type: boolean
 *         description: Qayta ishlangan fakturalar
 *     responses:
 *       200:
 *         description: Fakturalar ro'yxati
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
 *                     fakturas:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Faktura'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/', authMiddleware, generalLimiter, async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      fakturas: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
    },
  });
});

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
 *                     faktura:
 *                       $ref: '#/components/schemas/Faktura'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  res.json({
    success: true,
    data: { faktura: { id: parseInt(id) } },
  });
});

/**
 * @swagger
 * /api/faktura:
 *   post:
 *     summary: Yangi faktura yaratish
 *     description: Faktura ma'lumotlarini kiritish va yaratish
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
 *               - nomer
 *               - sana
 *               - mxik
 *               - tovar_nomi
 *               - miqdori
 *               - narxi
 *             properties:
 *               nomer:
 *                 type: string
 *                 example: FAK-001
 *                 description: Faktura raqami
 *               sana:
 *                 type: string
 *                 format: date
 *                 example: '2024-12-11'
 *                 description: Faktura sanasi
 *               mxik:
 *                 type: string
 *                 example: '12345678'
 *                 description: MXIK kodi
 *               tovar_nomi:
 *                 type: string
 *                 example: Dori vositalari
 *                 description: Tovar nomi
 *               olchov_birligi:
 *                 type: string
 *                 example: dona
 *                 description: O'lchov birligi
 *               miqdori:
 *                 type: number
 *                 format: decimal
 *                 example: 100.0
 *                 description: Miqdori
 *               narxi:
 *                 type: number
 *                 format: decimal
 *                 example: 50000.00
 *                 description: Narxi
 *               summa:
 *                 type: number
 *                 format: decimal
 *                 example: 5000000.00
 *                 description: Umumiy summa
 *               qqs_stavka:
 *                 type: number
 *                 format: decimal
 *                 example: 15.0
 *                 description: QQS stavkasi (%)
 *               qqs_summa:
 *                 type: number
 *                 format: decimal
 *                 example: 750000.00
 *                 description: QQS summasi
 *     responses:
 *       201:
 *         description: Faktura yaratildi
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
 *                   example: Faktura muvaffaqiyatli yaratildi
 *                 data:
 *                   type: object
 *                   properties:
 *                     faktura:
 *                       $ref: '#/components/schemas/Faktura'
 *       400:
 *         description: Validatsiya xatosi
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/', authMiddleware, generalLimiter, async (req: Request, res: Response) => {
  res.status(201).json({
    success: true,
    message: 'Faktura yaratildi',
    data: { faktura: req.body },
  });
});

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
 *               nomer:
 *                 type: string
 *               sana:
 *                 type: string
 *                 format: date
 *               mxik:
 *                 type: string
 *               tovar_nomi:
 *                 type: string
 *               miqdori:
 *                 type: number
 *               narxi:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *               processed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Faktura tahrirlandi
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
 *                   example: Faktura tahrirlandi
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/:id', authMiddleware, generalLimiter, async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Faktura tahrirlandi',
  });
});

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
 *                   example: Faktura o'chirildi
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Faktura o\'chirildi',
  });
});

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
 *                       example: 100
 *                       description: Jami fakturalar
 *                     active:
 *                       type: integer
 *                       example: 80
 *                       description: Aktiv fakturalar
 *                     processed:
 *                       type: integer
 *                       example: 60
 *                       description: Qayta ishlangan
 *                     pending:
 *                       type: integer
 *                       example: 20
 *                       description: Kutilmoqda
 *                     totalSum:
 *                       type: number
 *                       example: 50000000.00
 *                       description: Umumiy summa
 */
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      total: 100,
      active: 80,
      processed: 60,
      pending: 20,
      totalSum: 50000000.00,
    },
  });
});

export default router;