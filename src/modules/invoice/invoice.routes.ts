import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { generalLimiter } from '../../middlewares/rateLimiterMiddleware';

const router = Router();

/**
 * @swagger
 * /api/invoice/create:
 *   post:
 *     summary: Invoice yaratish
 *     description: Tax siteda yangi invoice yaratish (browser automation orqali)
 *     tags: [Invoice]
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
 *               - items
 *             properties:
 *               taxSiteTin:
 *                 type: string
 *                 description: Tax site TIN (agar userda saqlanmagan bo'lsa)
 *                 example: '123456789'
 *               taxSitePassword:
 *                 type: string
 *                 format: password
 *                 description: Tax site paroli
 *                 example: 'password123'
 *               nomer:
 *                 type: string
 *                 description: Invoice raqami
 *                 example: INV-001
 *               sana:
 *                 type: string
 *                 format: date
 *                 description: Invoice sanasi
 *                 example: '2024-12-11'
 *               items:
 *                 type: array
 *                 description: Invoice elementlari
 *                 items:
 *                   type: object
 *                   required:
 *                     - mxik
 *                     - tovar_nomi
 *                     - miqdori
 *                     - narxi
 *                   properties:
 *                     mxik:
 *                       type: string
 *                       example: '12345678'
 *                     tovar_nomi:
 *                       type: string
 *                       example: Dori vositalari
 *                     olchov_birligi:
 *                       type: string
 *                       example: dona
 *                     miqdori:
 *                       type: number
 *                       example: 100
 *                     narxi:
 *                       type: number
 *                       example: 50000
 *     responses:
 *       200:
 *         description: Invoice yaratildi
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
 *                   example: Invoice muvaffaqiyatli yaratildi
 *                 data:
 *                   type: object
 *                   properties:
 *                     invoiceId:
 *                       type: integer
 *                       example: 123
 *                     processedItems:
 *                       type: integer
 *                       example: 5
 *                     totalAmount:
 *                       type: number
 *                       example: 5000000.00
 *       400:
 *         description: Validatsiya xatosi yoki credentials yo'q
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Tax site credentials required
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/create', authMiddleware, generalLimiter, async (req: Request, res: Response) => {
  try {
    const { taxSiteTin, taxSitePassword, nomer, sana, items } = req.body;

    if (!taxSiteTin || !taxSitePassword) {
      return res.status(400).json({
        success: false,
        message: 'Tax site credentials required',
      });
    }

    // Invoice yaratish logikasi bu yerda bo'ladi
    res.json({
      success: true,
      message: 'Invoice created',
      data: {
        invoiceId: 123,
        processedItems: items?.length || 0,
        totalAmount: 5000000.00,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/invoice/{id}:
 *   get:
 *     summary: Invoice ma'lumotlarini olish
 *     description: ID bo'yicha invoice tafsilotlarini olish
 *     tags: [Invoice]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Invoice ID
 *     responses:
 *       200:
 *         description: Invoice ma'lumotlari
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
 *                     invoice:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 123
 *                         nomer:
 *                           type: string
 *                           example: INV-001
 *                         sana:
 *                           type: string
 *                           format: date
 *                           example: '2024-12-11'
 *                         status:
 *                           type: string
 *                           enum: [pending, processing, completed, failed]
 *                           example: completed
 *                         items:
 *                           type: array
 *                           items:
 *                             type: object
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID',
      });
    }

    res.json({
      success: true,
      data: {
        invoice: {
          id: invoiceId,
          nomer: 'INV-001',
          sana: '2024-12-11',
          status: 'completed',
          items: [],
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/invoice/list:
 *   get:
 *     summary: Invoice'lar ro'yxati
 *     description: Barcha invoice'larni olish (pagination bilan)
 *     tags: [Invoice]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Nechta element qaytarish
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Boshlanish pozitsiyasi
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         description: Status bo'yicha filtrlash
 *     responses:
 *       200:
 *         description: Invoice'lar ro'yxati
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
 *                     invoices:
 *                       type: array
 *                       items:
 *                         type: object
 *                     total:
 *                       type: integer
 *                       example: 50
 *                     limit:
 *                       type: integer
 *                       example: 100
 *                     offset:
 *                       type: integer
 *                       example: 0
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/list', authMiddleware, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    res.json({
      success: true,
      data: {
        invoices: [],
        total: 0,
        limit,
        offset,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

export default router;