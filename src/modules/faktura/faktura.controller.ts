// src/modules/faktura/faktura.controller.ts

import { Request, Response } from 'express';
import fakturaService from './faktura.service';
import multer from 'multer';
import path from 'path';

// Multer konfiguratsiyasi
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'faktura-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return cb(new Error('Faqat Excel fayllari (.xlsx, .xls) qabul qilinadi'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

class FakturaController {
  // Upload middleware
  public uploadMiddleware = upload.single('file');

  /**
   * GET /api/faktura
   * Barcha fakturalarni olish
   */
  async getAllFakturas(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const isActive = req.query.isActive === 'true' ? true : 
                       req.query.isActive === 'false' ? false : undefined;
      const mxik = req.query.mxik as string;

      const result = await fakturaService.getAllFakturas({
        page,
        limit,
        isActive,
        mxik,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Get all fakturas error:', error);
      return res.status(500).json({
        success: false,
        message: 'Fakturalarni olishda xatolik',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/faktura/stats
   * Faktura statistikasi
   */
  async getStats(req: Request, res: Response) {
    try {
      const stats = await fakturaService.getStats();

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Get stats error:', error);
      return res.status(500).json({
        success: false,
        message: 'Statistikani olishda xatolik',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/faktura/:id
   * Bitta fakturani olish
   */
  async getFakturaById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Noto\'g\'ri ID format',
        });
      }

      const faktura = await fakturaService.getFakturaById(id);

      if (!faktura) {
        return res.status(404).json({
          success: false,
          message: 'Faktura topilmadi',
        });
      }

      return res.status(200).json({
        success: true,
        data: { faktura },
      });
    } catch (error: any) {
      console.error('Get faktura by ID error:', error);
      return res.status(500).json({
        success: false,
        message: 'Fakturani olishda xatolik',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/faktura/import
   * Excel fayldan fakturalar import qilish
   */
  async importFromExcel(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Fayl yuklanmadi',
        });
      }

      const importId = req.body.importId ? parseInt(req.body.importId) : undefined;

      const result = await fakturaService.importFromExcel(
        req.file.path,
        importId
      );

      return res.status(200).json({
        success: true,
        message: 'Import muvaffaqiyatli yakunlandi',
        data: result,
      });
    } catch (error: any) {
      console.error('Import error:', error);
      return res.status(500).json({
        success: false,
        message: 'Import jarayonida xatolik',
        error: error.message,
      });
    }
  }

  /**
   * PUT /api/faktura/:id
   * Fakturani tahrirlash
   */
  async updateFaktura(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Noto\'g\'ri ID format',
        });
      }

      const updatedFaktura = await fakturaService.updateFaktura(id, req.body);

      if (!updatedFaktura) {
        return res.status(404).json({
          success: false,
          message: 'Faktura topilmadi',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Faktura muvaffaqiyatli tahrirlandi',
        data: { faktura: updatedFaktura },
      });
    } catch (error: any) {
      console.error('Update faktura error:', error);
      return res.status(500).json({
        success: false,
        message: 'Fakturani tahrirlashda xatolik',
        error: error.message,
      });
    }
  }

  /**
   * DELETE /api/faktura/:id
   * Fakturani o'chirish (soft delete)
   */
  async deleteFaktura(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Noto\'g\'ri ID format',
        });
      }

      const deleted = await fakturaService.deleteFaktura(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Faktura topilmadi',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Faktura muvaffaqiyatli o\'chirildi',
      });
    } catch (error: any) {
      console.error('Delete faktura error:', error);
      return res.status(500).json({
        success: false,
        message: 'Fakturani o\'chirishda xatolik',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/faktura/bulk/delete
   * Ko'plab fakturalarni o'chirish
   */
  async bulkDeleteFakturas(req: Request, res: Response) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'IDs array bo\'sh yoki noto\'g\'ri',
        });
      }

      const deletedCount = await fakturaService.bulkDeleteFakturas(ids);

      return res.status(200).json({
        success: true,
        message: `${deletedCount} ta faktura o'chirildi`,
        data: { deletedCount },
      });
    } catch (error: any) {
      console.error('Bulk delete error:', error);
      return res.status(500).json({
        success: false,
        message: 'Fakturalarni o\'chirishda xatolik',
        error: error.message,
      });
    }
  }
}

export default new FakturaController();