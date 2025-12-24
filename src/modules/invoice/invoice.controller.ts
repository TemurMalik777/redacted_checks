import { Request, Response, NextFunction } from 'express';
import invoiceService from './invoice.service';
import logger from '../../logs/logger.service';

/**
 * Invoice Controller
 * HTTP layer - request/response handling
 */
export class InvoiceController {
  /**
   * Invoice yaratish
   * POST /api/invoice/create
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { taxSiteTin, taxSitePassword, nomer, sana, items } = req.body;

      // Basic validation
      if (!taxSiteTin || !taxSitePassword) {
        res.status(400).json({
          success: false,
          message: 'Tax site credentials required',
        });
        return;
      }

      if (!nomer || !sana || !items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Invoice nomer, sana va kamida 1 ta mahsulot kerak',
        });
        return;
      }

      logger.info(`🚀 Invoice yaratish boshlandi: ${nomer}`);

      // Service ga murojaat
      const result = await invoiceService.createInvoice(
        {
          contractNumber: nomer,
          contractDate: sana,
          sellerTin: taxSiteTin,
          products: items.map((item: any) => ({
            mxik: item.mxik,
            name: item.tovar_nomi,
            measureUnit: item.olchov_birligi || 'dona',
            quantity: parseFloat(item.miqdori),
            price: parseFloat(item.narxi),
            vatRate: parseFloat(item.qqs_stavka || '0'),
          })),
        },
        {
          tin: taxSiteTin,
          password: taxSitePassword,
        }
      );

      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json(result);
    } catch (error: any) {
      logger.error(`❌ Invoice controller error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Invoice ma'lumotlarini olish
   * GET /api/invoice/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoiceId = parseInt(req.params.id);

      if (isNaN(invoiceId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid invoice ID',
        });
        return;
      }

      logger.info(`📖 Invoice olish: ID=${invoiceId}`);

      const result = await invoiceService.getInvoice(invoiceId);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error: any) {
      logger.error(`❌ Get invoice error: ${error.message}`);
      next(error);
    }
  }

  /**
   * Barcha invoice'lar ro'yxati
   * GET /api/invoice/list
   */
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string | undefined;

      logger.info(`📋 Invoice ro'yxati: limit=${limit}, offset=${offset}`);

      const result = await invoiceService.getAllInvoices(limit, offset);

      res.status(200).json({
        success: true,
        data: {
          invoices: result.data || [],
          total: result.count || 0,
          limit,
          offset,
        },
      });
    } catch (error: any) {
      logger.error(`❌ Get all invoices error: ${error.message}`);
      next(error);
    }
  }
}

export default new InvoiceController();
