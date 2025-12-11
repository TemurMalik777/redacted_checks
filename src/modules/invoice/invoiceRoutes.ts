import { Router, Request, Response } from 'express';
import invoiceService from './invoiceService';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { generalLimiter } from '../../middlewares/rateLimiterMiddleware';  // ← O'zgardi
import { CreateInvoiceRequest } from './invoiceTypes';

const router = Router();

/**
 * POST /api/invoice/create
 */
router.post(
  '/create',
  authMiddleware,
  generalLimiter,  // ← O'zgardi
  async (req: Request, res: Response) => {
    try {
      const invoiceRequest: CreateInvoiceRequest = req.body;

      const credentials = {
        tin: req.body.taxSiteTin || (req as any).user?.taxSiteTin,
        password: req.body.taxSitePassword || (req as any).user?.taxSitePassword,
      };

      if (!credentials.tin || !credentials.password) {
        return res.status(400).json({
          success: false,
          message: 'Tax site credentials required',
        });
      }

      const result = await invoiceService.createInvoice(invoiceRequest, credentials);
      res.status(result.success ? 200 : 400).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/invoice/:id
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

    const result = await invoiceService.getInvoice(invoiceId);
    res.status(result.success ? 200 : 404).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

/**
 * GET /api/invoice/list
 */
router.get('/list', authMiddleware, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await invoiceService.getAllInvoices(limit, offset);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

export default router;