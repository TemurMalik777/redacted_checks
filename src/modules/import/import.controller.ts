import { Request, Response, NextFunction } from 'express';
import { ImportService } from './import.service';

const service = new ImportService();

/**
 * ImportController
 */
export class ImportController {
  /**
   * Barcha import'larni olish
   * GET /api/import
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        page,
        limit,
        isActive,
        processed,
        status,
        source,
        importedBy,
        search,
        sortBy,
        order,
        dateFrom,
        dateTo,
      } = req.query;

      const result = await service.getAll({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        processed: processed === 'true' ? true : processed === 'false' ? false : undefined,
        status: status as any,
        source: source as any,
        importedBy: importedBy ? parseInt(importedBy as string) : undefined,
        search: search as string,
        sortBy: sortBy as string,
        order: (order as string)?.toUpperCase() as 'ASC' | 'DESC',
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      });

      res.status(200).json({
        success: true,
        message: "Import'lar muvaffaqiyatli olindi",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bitta import'ni olish
   * GET /api/import/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const importRecord = await service.getById(parseInt(id));

      res.status(200).json({
        success: true,
        data: importRecord,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * User'ning import'larini olish
   * GET /api/import/user/:userId
   */
  async getByUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { limit } = req.query;

      const imports = await service.getByUser(
        parseInt(userId),
        limit ? parseInt(limit as string) : undefined,
      );

      res.status(200).json({
        success: true,
        data: imports,
        count: imports.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Yangi import yaratish
   * POST /api/import
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const importRecord = await service.create(req.body);

      res.status(201).json({
        success: true,
        message: 'Import muvaffaqiyatli yaratildi',
        data: importRecord,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Import'ni yangilash
   * PUT /api/import/:id
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const importRecord = await service.update(parseInt(id), req.body);

      res.status(200).json({
        success: true,
        message: 'Import muvaffaqiyatli yangilandi',
        data: importRecord,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Import'ni o'chirish
   * DELETE /api/import/:id
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
   * Ko'p import'larni o'chirish
   * POST /api/import/bulk/delete
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
   * Import'ni boshlash
   * POST /api/import/:id/start
   */
  async startImport(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const importRecord = await service.startImport(parseInt(id));

      res.status(200).json({
        success: true,
        message: 'Import boshlandi',
        data: importRecord,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Import'ni tugallash
   * POST /api/import/:id/complete
   */
  async completeImport(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { importedRows, failedRows, errorMessage } = req.body;

      const importRecord = await service.completeImport(parseInt(id), {
        importedRows,
        failedRows,
        errorMessage,
      });

      res.status(200).json({
        success: true,
        message: 'Import tugallandi',
        data: importRecord,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Import'ni xato bilan tugallash
   * POST /api/import/:id/fail
   */
  async failImport(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { errorMessage } = req.body;

      const importRecord = await service.failImport(parseInt(id), errorMessage);

      res.status(200).json({
        success: true,
        message: 'Import xato bilan tugallandi',
        data: importRecord,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Import'ni qayta boshlash
   * POST /api/import/:id/retry
   */
  async retryImport(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const importRecord = await service.retryImport(parseInt(id));

      res.status(200).json({
        success: true,
        message: 'Import qayta boshlandi',
        data: importRecord,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Import'ni bekor qilish
   * POST /api/import/:id/cancel
   */
  async cancelImport(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const importRecord = await service.cancelImport(parseInt(id));

      res.status(200).json({
        success: true,
        message: 'Import bekor qilindi',
        data: importRecord,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Active import'larni olish
   * GET /api/import/active
   */
  async getActiveImports(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit } = req.query;
      const imports = await service.getActiveImports(
        limit ? parseInt(limit as string) : undefined,
      );

      res.status(200).json({
        success: true,
        data: imports,
        count: imports.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Pending import'larni olish
   * GET /api/import/pending
   */
  async getPendingImports(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit } = req.query;
      const imports = await service.getPendingImports(
        limit ? parseInt(limit as string) : undefined,
      );

      res.status(200).json({
        success: true,
        data: imports,
        count: imports.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Failed import'larni olish
   * GET /api/import/failed
   */
  async getFailedImports(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit } = req.query;
      const imports = await service.getFailedImports(
        limit ? parseInt(limit as string) : undefined,
      );

      res.status(200).json({
        success: true,
        data: imports,
        count: imports.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Oxirgi import'larni olish
   * GET /api/import/recent
   */
  async getRecent(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit, userId } = req.query;

      const imports = await service.getRecent(
        limit ? parseInt(limit as string) : undefined,
        userId ? parseInt(userId as string) : undefined,
      );

      res.status(200).json({
        success: true,
        data: imports,
        count: imports.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Statistika
   * GET /api/import/stats
   */
  async getStatistics(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.query;

      const stats = await service.getStatistics(
        userId ? parseInt(userId as string) : undefined,
      );

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * User statistikasi
   * GET /api/import/stats/user/:userId
   */
  async getUserStatistics(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const stats = await service.getUserStatistics(parseInt(userId));

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * isActive'ni o'zgartirish
   * PATCH /api/import/:id/toggle-active
   */
  async toggleActive(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const importRecord = await service.toggleActive(parseInt(id));

      res.status(200).json({
        success: true,
        message: "isActive holati o'zgartirildi",
        data: importRecord,
      });
    } catch (error) {
      next(error);
    }
  }
}