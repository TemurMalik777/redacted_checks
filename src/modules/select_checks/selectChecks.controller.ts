import { Request, Response, NextFunction } from 'express';
import { SelectChecksService } from './selectChecks.service';
import sequelize from '../../config/database';

const service = new SelectChecksService();

/**
 * SelectChecksController
 */
export class SelectChecksController {
  /**
   * 🆕 GENERATE - Faktura va cheklarni moslashtirish
   * POST /api/select-checks/generate
   */
  async generate(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('\n🚀 SELECT_CHECKS GENERATE boshlandi...\n');

      const result = await service.processAllFakturas(sequelize);

      res.status(200).json({
        success: true,
        message: `${result.results.length} ta select_check yaratildi`,
        data: {
          created: result.results.length,
          processed: result.processed,
          failed: result.failed,
        },
      });
    } catch (error) {
      console.error('❌ Generate xatosi:', error);
      next(error);
    }
  }

  /**
   * 🆕 RESET - Barcha ma'lumotlarni qayta tiklash
   * POST /api/select-checks/reset
   */
  async reset(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('\n⚠️ SELECT_CHECKS RESET boshlandi...\n');

      const result = await service.resetAll(sequelize);

      res.status(200).json({
        success: true,
        message: 'Barcha ma\'lumotlar reset qilindi',
        data: result,
      });
    } catch (error) {
      console.error('❌ Reset xatosi:', error);
      next(error);
    }
  }

  /**
   * Barcha select_checks'larni olish
   * GET /api/select-checks
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        page,
        limit,
        isActive,
        processed,
        automationStatus,
        search,
        sortBy,
        order,
      } = req.query;

      const result = await service.getAll({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        processed: processed === 'true' ? true : processed === 'false' ? false : undefined,
        automationStatus: automationStatus as any,
        search: search as string,
        sortBy: sortBy as string,
        order: (order as string)?.toUpperCase() as 'ASC' | 'DESC',
      });

      res.status(200).json({
        success: true,
        message: 'Select checks muvaffaqiyatli olindi',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bitta select_check'ni olish
   * GET /api/select-checks/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const selectCheck = await service.getById(parseInt(id));

      res.status(200).json({
        success: true,
        data: selectCheck,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Yangi select_check yaratish
   * POST /api/select-checks
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const selectCheck = await service.create(req.body);

      res.status(201).json({
        success: true,
        message: 'Select check muvaffaqiyatli yaratildi',
        data: selectCheck,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Select_check'ni yangilash
   * PUT /api/select-checks/:id
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const selectCheck = await service.update(parseInt(id), req.body);

      res.status(200).json({
        success: true,
        message: 'Select check muvaffaqiyatli yangilandi',
        data: selectCheck,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Select_check'ni o'chirish
   * DELETE /api/select-checks/:id
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await service.delete(parseInt(id));

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Ko'p select_check'larni o'chirish
   * POST /api/select-checks/bulk/delete
   */
  async bulkDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids } = req.body;
      const result = await service.bulkDelete(ids);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Ko'p select_check'larning holatini yangilash
   * POST /api/select-checks/bulk/update-status
   */
  async bulkUpdateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids, automationStatus } = req.body;
      const result = await service.bulkUpdateStatus(ids, automationStatus);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * isActive'ni o'zgartirish
   * PATCH /api/select-checks/:id/toggle-active
   */
  async toggleActive(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const selectCheck = await service.toggleActive(parseInt(id));

      res.status(200).json({
        success: true,
        message: 'isActive holati o\'zgartirildi',
        data: selectCheck,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Processed qilish
   * PATCH /api/select-checks/:id/mark-processed
   */
  async markAsProcessed(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const selectCheck = await service.markAsProcessed(parseInt(id));

      res.status(200).json({
        success: true,
        message: 'Select check processed qilindi',
        data: selectCheck,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Automation uchun tayyor qilish
   * PATCH /api/select-checks/:id/mark-ready
   */
  async markAsReadyForProcessing(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const selectCheck = await service.markAsReadyForProcessing(parseInt(id));

      res.status(200).json({
        success: true,
        message: 'Automation uchun tayyor qilindi',
        data: selectCheck,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Xato';
      res.status(400).json({
        success: false,
        message,
      });
    }
  }

  /**
   * Statistika
   * GET /api/select-checks/stats
   */
  async getStatistics(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await service.getStatistics();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 🆕 Faktura-Check moslashtirish preview
   * GET /api/select-checks/preview
   */
  async getPreview(req: Request, res: Response, next: NextFunction) {
    try {
      const fakturas = await service.getActiveFakturasRaw(sequelize);
      
      // Har bir faktura uchun potensial cheklar sonini ko'rsatish
      const preview = [];
      for (const faktura of fakturas.slice(0, 10)) { // Faqat 10 ta
        const maxSumma = faktura.faktura_summa * (1 + service['TOLERANCE_PERCENT']);
        const checks = await service.getUnprocessedChecksAfterDateRaw(
          sequelize,
          faktura.creation_data_faktura,
          maxSumma
        );
        
        preview.push({
          faktura_id: faktura.id,
          mxik: faktura.mxik,
          faktura_summa: faktura.faktura_summa,
          faktura_sana: faktura.creation_data_faktura,
          available_checks: checks.length,
          max_summa: maxSumma,
        });
      }

      res.status(200).json({
        success: true,
        message: 'Preview ma\'lumotlari',
        data: {
          total_fakturas: fakturas.length,
          preview,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}