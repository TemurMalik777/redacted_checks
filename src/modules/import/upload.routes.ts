// src/modules/import/upload.routes.ts

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { ExcelImportService } from '../../services/excelImportService';

const router = Router();

// ✅ Multer konfiguratsiya
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return cb(new Error('Faqat Excel fayl yuklash mumkin!'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * @swagger
 * /api/import/upload-excel:
 *   post:
 *     summary: Excel faylni yuklash va import qilish
 *     description: Excel fayldan checks va fakturalarni import qilish va select_checks yaratish
 *     tags: [Import]
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
 *     responses:
 *       200:
 *         description: Import muvaffaqiyatli
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
 *                   example: Excel muvaffaqiyatli import qilindi
 *                 data:
 *                   type: object
 *                   properties:
 *                     importId:
 *                       type: integer
 *                       example: 123
 *                     checksCount:
 *                       type: integer
 *                       example: 150
 *                     fakturasCount:
 *                       type: integer
 *                       example: 75
 *                     selectChecksCount:
 *                       type: integer
 *                       example: 200
 *       400:
 *         description: Noto'g'ri fayl formati
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  '/upload-excel',
  authMiddleware,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Fayl yuklanmadi',
        });
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Autentifikatsiya talab qilinadi',
        });
      }

      const service = new ExcelImportService();
      const result = await service.importExcelFile(
        req.file.path,
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: 'Excel muvaffaqiyatli import qilindi',
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import xatosi';
      res.status(500).json({
        success: false,
        message,
      });
    }
  }
);

export default router;