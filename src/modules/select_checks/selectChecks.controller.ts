import { Request, Response, NextFunction } from 'express';
import { SelectChecksService } from './selectChecks.service';
import sequelize from '../../config/database';
import { processExcelUI } from '../../automation/actions/processExcel';
import { CheckData } from '../../automation/actions/fieldFiller';
import { chromium, Browser, Page } from 'playwright';

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

      // Har bir faktura uchun potensial cheklar sonini ko'rsatish (3 bosqichli)
      const preview = [];
      for (const faktura of fakturas.slice(0, 10)) { // Faqat 10 ta
        const checks = await service.getUnprocessedChecksAfterDateRaw(
          sequelize,
          faktura.creation_data_faktura
        );

        preview.push({
          faktura_id: faktura.id,
          mxik: faktura.mxik,
          faktura_summa: faktura.faktura_summa,
          faktura_sana: faktura.creation_data_faktura,
          available_checks: checks.length,
          strategy: '3 bosqichli: Aniq teng / 0-3% ko\'p / 0-2% kam',
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

  /**
   * 🔄 AUTOMATION PREPARE - Select checkslarni automation uchun tayyor qilish
   * POST /api/select-checks/automation/prepare
   */
  async prepareForAutomation(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit = 100 } = req.body;

      console.log(`\n🔄 Automation uchun tayyor qilish boshlandi (limit: ${limit})...\n`);

      const result = await service.prepareForAutomation(limit);

      res.status(200).json({
        success: true,
        message: `${result.updated} ta select_check automation uchun tayyor qilindi`,
        data: result,
      });
    } catch (error) {
      console.error('❌ Prepare xatosi:', error);
      const message = error instanceof Error ? error.message : 'Prepare xatosi';
      res.status(500).json({
        success: false,
        message,
        error: message,
      });
    }
  }

  /**
   * 🤖 AUTOMATION - Select checkslarni UI orqali qayta ishlash
   * POST /api/select-checks/automation/process
   *
   * Bu endpoint:
   * 1. Browser ochadi
   * 2. Login bo'lishni kutadi
   * 3. Select_checks jadvalidan "ready" holatdagi ma'lumotlarni oladi
   * 4. Har bir chekni UI orqali qayta ishlaydi
   * 5. Natijalarni qaytaradi
   */
  async processWithAutomation(req: Request, res: Response, next: NextFunction) {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      const { captchaApiKey, headless = false } = req.body;

      if (!captchaApiKey) {
        return res.status(400).json({
          success: false,
          message: 'CAPTCHA API key kiritilishi shart',
        });
      }

      console.log('\n🤖 AUTOMATION BOSHLANDI...\n');

      // 1️⃣ Browser ochish
      console.log('📱 Browser ochilmoqda...');
      browser = await chromium.launch({
        headless,
        args: ['--disable-blink-features=AutomationControlled'],
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      });

      page = await context.newPage();
      console.log('✅ Browser ochildi\n');

      // 1.5️⃣ Soliq.uz saytiga kirish
      const TAX_SITE_URL = process.env.TAX_SITE_URL || 'https://my3.soliq.uz/login';
      console.log(`🌐 ${TAX_SITE_URL} ga kirilmoqda...`);
      await page.goto(TAX_SITE_URL);
      console.log('✅ Saytga kirildi\n');

      // 2️⃣ Select_checks jadvalidan ma'lumotlarni olish
      console.log('📊 Select_checks ma\'lumotlari yuklanmoqda...');
      const selectChecks = await service.getAllForAutomation();

      if (!selectChecks || selectChecks.length === 0) {
        await browser.close();
        return res.status(200).json({
          success: true,
          message: 'Qayta ishlanadigan select_checks yo\'q',
          data: {
            total: 0,
            success: 0,
            failed: 0,
          },
        });
      }

      console.log(`✅ ${selectChecks.length} ta select_check topildi\n`);

      // 3️⃣ Ma'lumotlarni CheckData formatiga o'tkazish
      const checkDataArray: CheckData[] = selectChecks.map((sc: any) => ({
        chek_raqam: sc.chek_raqam,
        mxik: sc.mxik,
        ulchov: sc.ulchov,
        miqdor: sc.miqdor,
        amount: sc.amount,
        bir_birlik: sc.bir_birlik,
      }));

      // 4️⃣ Automation jarayonini boshlash
      console.log('🚀 UI automation boshlandi...\n');
      const result = await processExcelUI(page, checkDataArray, captchaApiKey);

      // 5️⃣ Browser yopish
      await browser.close();
      console.log('\n✅ Browser yopildi');

      // 6️⃣ Natijani qaytarish
      res.status(200).json({
        success: true,
        message: 'Automation jarayoni yakunlandi',
        data: {
          total: result.total,
          success: result.success,
          failed: result.failed,
        },
      });
    } catch (error) {
      console.error('❌ Automation xatosi:', error);

      // Browser yopish (xato bo'lsa)
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          console.error('Browser yopishda xato:', e);
        }
      }

      const message = error instanceof Error ? error.message : 'Automation xatosi';
      res.status(500).json({
        success: false,
        message,
        error: message,
      });
    }
  }
}