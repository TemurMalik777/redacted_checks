import { Request, Response } from 'express';
import { automationService } from './automation.service';

/**
 * Automation Controller
 * Request/Response handling
 */
export class AutomationController {
  /**
   * POST /api/automation/init
   * Browser ni initialize qilish
   */
  async initializeBrowser(req: Request, res: Response): Promise<void> {
    try {
      const { headless = true } = req.body;
      const userId = req.user!.id;

      const result = await automationService.initializeBrowser(userId, headless);

      res.json({
        success: true,
        message: 'Browser va session muvaffaqiyatli yaratildi',
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Browser initialize qilishda xato',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/automation/login
   * Tax site ga login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { tin, password, captcha } = req.body;
      const userId = req.user!.id;

      if (!tin || !password) {
        res.status(400).json({
          success: false,
          message: 'TIN va parol kiritilishi shart',
        });
        return;
      }

      const result = await automationService.login(userId, tin, password, captcha);

      res.json({
        success: result.success,
        message: result.message,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Login xatosi',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/automation/create-invoice
   * Invoice yaratish
   */
  async createInvoice(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const invoiceData = req.body;

      const result = await automationService.createInvoice(userId, invoiceData);

      res.json({
        success: result.success,
        message: result.message,
      });
    } catch (error: any) {
      const statusCode = error.message.includes('login') ? 401 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/automation/logout
   * Logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const result = await automationService.logout(userId);

      res.json({
        success: result.success,
        message: result.message,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Logout xatosi',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/automation/close
   * Sessionni yopish
   */
  async closeSession(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      await automationService.closeSession(userId);

      res.json({
        success: true,
        message: 'Session va browser muvaffaqiyatli yopildi',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Close xatosi',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/automation/status
   * Session statusini olish
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const result = await automationService.getSessionStatus(userId);

      res.json({
        success: true,
        data: {
          userId,
          ...result,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Status tekshirishda xato',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/automation/sessions/all
   * Barcha sessionlarni olish
   */
  async getAllSessions(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Admin check qo'shish
      const sessions = await automationService.getAllSessions();

      res.json({
        success: true,
        data: {
          totalSessions: sessions.length,
          sessions,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Sessionlarni olishda xato',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/automation/session/refresh
   * Session TTL ni yangilash
   */
  async refreshSession(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      await automationService.refreshSession(userId);

      res.json({
        success: true,
        message: 'Session TTL yangilandi',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'TTL yangilashda xato',
        error: error.message,
      });
    }
  }
}

export const automationController = new AutomationController();