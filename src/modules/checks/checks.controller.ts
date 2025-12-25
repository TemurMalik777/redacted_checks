import { Request, Response } from 'express';
import checksService from './checks.service';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import xlsx from 'xlsx';
import sequelize from '../../config/database';
import Check from '../checks/checks.model';

// Multer konfiguratsiyasi
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../uploads/checks');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `checks-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Faqat Excel fayl (.xlsx, .xls) yuklash mumkin'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

class ChecksController {
  /**
   * Multer middleware
   */
  uploadMiddleware = upload.single('file');

  /**
   * GET /api/checks/stats
   * Checklar statistikasi
   */
  getStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const stats = await checksService.getStatistics(userId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Statistika olishda xato',
      });
    }
  };

  /**
   * POST /api/checks/import
   * Excel fayldan import qilish
   */
  // src/modules/checks/checks.controller.ts

  async importFromExcel(req: Request, res: Response) {
    const transaction = await sequelize.transaction();

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Fayl yuklanmadi',
        });
      }

      // ✅ Helper function: Sanani parse qilish
      const parseExcelDate = (dateInput: any): string => {
        if (!dateInput)
          return new Date().toLocaleDateString('en-GB').replace(/\//g, '.');

        const dateStr = String(dateInput).trim();

        // "Invalid Date" yoki bo'sh
        if (dateStr === 'Invalid Date' || dateStr === '') {
          return new Date().toLocaleDateString('en-GB').replace(/\//g, '.');
        }

        // Format: "26.01.2024 10:05:44" yoki "26.01.2024"
        if (dateStr.includes('.')) {
          const datePart = dateStr.split(' ')[0]; // Faqat sana qismini olamiz
          return datePart; // "26.01.2024"
        }

        // Excel serial number formatini parse qilish
        if (!isNaN(Number(dateStr))) {
          const excelEpoch = new Date(1899, 11, 30);
          const days = Number(dateStr);
          const date = new Date(excelEpoch.getTime() + days * 86400000);
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          return `${day}.${month}.${year}`;
        }

        // ISO format yoki boshqa format
        try {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
          }
        } catch (e) {
          // ignore
        }

        return new Date().toLocaleDateString('en-GB').replace(/\//g, '.');
      };

      // Excel faylni o'qish
      const workbook = xlsx.readFile(req.file.path);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = xlsx.utils.sheet_to_json(worksheet);

      const results = {
        total: rows.length,
        imported: 0,
        failed: 0,
        skipped: 0,
        errors: [] as any[],
      };

      const importId = req.body.importId
        ? parseInt(req.body.importId)
        : undefined;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Foydalanuvchi topilmadi',
        });
      }

      // Har bir qatorni qayta ishlash
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2;

        try {
          const hasCheckData =
            row['creation_date_check'] &&
            row['chek_raqam'] &&
            row['chek_summa'] &&
            row['maxsulot_nomi'];

          if (!hasCheckData) {
            results.skipped++;
            results.errors.push({
              row: rowNumber,
              message: "Checks uchun majburiy maydonlar to'ldirilmagan",
              data: row,
            });
            continue;
          }

          // Check raqam dublikat tekshirish
          const existingCheck = await Check.findOne({
            where: { chekRaqam: row['chek_raqam'].toString().trim() },
            transaction,
          });

          if (existingCheck) {
            results.skipped++;
            results.errors.push({
              row: rowNumber,
              message: `Dublikat chek raqam: ${row['chek_raqam']}`,
              data: row,
            });
            continue;
          }

          // ✅ CHECK NI YARATISH (to'g'rilangan)
          await Check.create(
            {
              creation_date_check: parseExcelDate(row['creation_date_check']),
              chekRaqam: row['chek_raqam'].toString().trim(),
              chekSumma: parseFloat(row['chek_summa']) || 0,
              maxsulotNomi: row['maxsulot_nomi'],
              processed: false,
              createdBy: userId,
              ...(importId && { importId }),
            },
            { transaction },
          );

          results.imported++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            message: error.message || "Noma'lum xatolik",
            data: row,
          });
          console.error(`Qator ${rowNumber} xatosi:`, error);
        }
      }

      await transaction.commit();

      // Yuklangan faylni o'chirish
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(200).json({
        success: true,
        message: 'Import muvaffaqiyatli yakunlandi',
        data: results,
      });
    } catch (error: any) {
      await transaction.rollback();

      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error("Fayl o'chirishda xatolik:", unlinkError);
        }
      }

      console.error('Import xatosi:', error);

      return res.status(500).json({
        success: false,
        message: 'Import jarayonida xatolik',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/checks/bulk/delete
   * Ko'plab checklarni o'chirish
   */
  bulkDeleteChecks = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          success: false,
          message: "IDs array bo'sh yoki noto'g'ri",
        });
        return;
      }

      const result = await checksService.bulkDeleteChecks(ids, req.user!.id);

      res.status(200).json({
        success: true,
        message: result.message,
        data: { deleted: result.deleted },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Xato';
      console.error('Bulk delete checks error:', error);

      res.status(500).json({
        success: false,
        message,
      });
    }
  };

  /**
   * POST /api/checks/bulk/mark-processed
   */
  markAsProcessed = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          success: false,
          message: "IDs array bo'sh",
        });
        return;
      }

      const result = await checksService.markAsProcessed(ids);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error('Mark as processed error:', error);
      res.status(500).json({
        success: false,
        message: 'Checklar processed qilishda xato',
      });
    }
  };

  /**
   * POST /api/checks/bulk/mark-unprocessed
   */
  markAsUnprocessed = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          success: false,
          message: "IDs array bo'sh",
        });
        return;
      }

      const result = await checksService.markAsUnprocessed(ids);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error('Mark as unprocessed error:', error);
      res.status(500).json({
        success: false,
        message: 'Checklar unprocessed qilishda xato',
      });
    }
  };

  /**
   * GET /api/checks
   * Barcha checklar ro'yxati
   */
  getAllChecks = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string;
      const processed =
        req.query.processed === 'true'
          ? true
          : req.query.processed === 'false'
          ? false
          : undefined;
      const importId = req.query.importId
        ? parseInt(req.query.importId as string)
        : undefined;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const result = await checksService.getAllChecks({
        page,
        limit,
        search,
        processed,
        userId: req.user?.id,
        importId,
        startDate,
        endDate,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Get all checks error:', error);
      res.status(500).json({
        success: false,
        message: "Checklar ro'yxatini olishda xato",
      });
    }
  };

  /**
   * POST /api/checks
   * Yangi check yaratish
   */
  createCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const { creation_date_check, chekRaqam, chekSumma, maxsulotNomi } =
        req.body;

      if (!creation_date_check || !chekRaqam || !chekSumma || !maxsulotNomi) {
        res.status(400).json({
          success: false,
          message: "Barcha majburiy maydonlar to'ldirilishi kerak",
        });
        return;
      }

      const check = await checksService.createCheck({
        creation_date_check,
        chekRaqam,
        chekSumma: parseFloat(chekSumma),
        maxsulotNomi,
        userId: req.user!.id,
      });

      res.status(201).json({
        success: true,
        message: 'Check muvaffaqiyatli yaratildi',
        data: { check },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Xato';

      if (message.includes('allaqachon mavjud')) {
        res.status(400).json({
          success: false,
          message,
        });
        return;
      }

      console.error('Create check error:', error);
      res.status(500).json({
        success: false,
        message: 'Check yaratishda xato',
      });
    }
  };

  /**
   * GET /api/checks/search
   */
  searchByChekRaqam = async (req: Request, res: Response): Promise<void> => {
    try {
      const { chekRaqam } = req.query;

      if (!chekRaqam) {
        res.status(400).json({
          success: false,
          message: 'chekRaqam parameter kiritilmagan',
        });
        return;
      }

      const check = await checksService.findByChekRaqam(chekRaqam as string);

      res.status(200).json({
        success: true,
        data: { check },
      });
    } catch (error) {
      console.error('Search by chek raqam error:', error);
      res.status(500).json({
        success: false,
        message: 'Qidirishda xato',
      });
    }
  };

  /**
   * GET /api/checks/:id
   * Bitta checkni olish
   */
  getCheckById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const check = await checksService.getCheckById(parseInt(id));

      res.status(200).json({
        success: true,
        data: { check },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Xato';

      if (message === 'Check topilmadi') {
        res.status(404).json({
          success: false,
          message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Check ma'lumotini olishda xato",
      });
    }
  };

  /**
   * PUT /api/checks/:id
   * Checkni tahrirlash
   */
  updateCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const {
        creation_date_check,
        chekRaqam,
        chekSumma,
        maxsulotNomi,
        processed,
      } = req.body;

      const updateData: any = {};

      if (creation_date_check)
        updateData.creation_date_check = creation_date_check;
      if (chekRaqam) updateData.chekRaqam = chekRaqam;
      if (chekSumma !== undefined) updateData.chekSumma = parseFloat(chekSumma);
      if (maxsulotNomi) updateData.maxsulotNomi = maxsulotNomi;
      if (typeof processed === 'boolean') updateData.processed = processed;

      const check = await checksService.updateCheck(parseInt(id), updateData);

      res.status(200).json({
        success: true,
        message: 'Check muvaffaqiyatli tahrirlandi',
        data: { check },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Xato';

      if (message === 'Check topilmadi') {
        res.status(404).json({
          success: false,
          message,
        });
        return;
      }

      if (message.includes('boshqa checkda mavjud')) {
        res.status(400).json({
          success: false,
          message,
        });
        return;
      }

      console.error('Update check error:', error);
      res.status(500).json({
        success: false,
        message: 'Check tahrirlashda xato',
      });
    }
  };

  /**
   * DELETE /api/checks/:id
   * Checkni o'chirish
   */
  deleteCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await checksService.deleteCheck(parseInt(id));

      res.status(200).json({
        success: true,
        message: "Check muvaffaqiyatli o'chirildi",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Xato';

      if (message === 'Check topilmadi') {
        res.status(404).json({
          success: false,
          message,
        });
        return;
      }

      if (message.includes('Qayta ishlangan')) {
        res.status(400).json({
          success: false,
          message,
        });
        return;
      }

      console.error('Delete check error:', error);
      res.status(500).json({
        success: false,
        message: "Check o'chirishda xato",
      });
    }
  };
}

export default new ChecksController();
