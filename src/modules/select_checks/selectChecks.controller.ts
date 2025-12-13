import { Request, Response, NextFunction } from 'express';
import { SelectChecksService } from './selectChecks.service';

const service = new SelectChecksService();

/**
 * SelectChecksController
 */
export class SelectChecksController {
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
}