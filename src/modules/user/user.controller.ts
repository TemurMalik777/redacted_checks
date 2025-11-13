import { Request, Response } from 'express';
import authService from '../../middlewares/authService';

/**
 * User Controller
 * 
 * Bu controller autentifikatsiya endpointlari uchun
 */
class UserController {
  /**
   * POST /api/auth/register
   * 
   * Yangi user ro'yxatdan o'tkazish
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { user, token } = await authService.register(req.body);

      res.status(201).json({
        success: true,
        message: 'Muvaffaqiyatli ro\'yxatdan o\'tdingiz!',
        data: {
          user: user.toJSON(),
          token,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ro\'yxatdan o\'tishda xato';
      
      res.status(400).json({
        success: false,
        message,
      });
    }
  }

  /**
   * POST /api/auth/login
   * 
   * Login qilish
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { user, token } = await authService.login(req.body);

      res.status(200).json({
        success: true,
        message: 'Muvaffaqiyatli login qildingiz!',
        data: {
          user: user.toJSON(),
          token,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login qilishda xato';
      
      res.status(401).json({
        success: false,
        message,
      });
    }
  }

  /**
   * GET /api/auth/me
   * 
   * Hozirgi userni olish (token orqali)
   * 
   * IZOH: authMiddleware orqali req.user allaqachon mavjud
   */
  async getMe(req: Request, res: Response): Promise<void> {
    try {
      // authMiddleware req.user ni qo'shgan
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Autentifikatsiya talab qilinadi',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: req.user.toJSON(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'User ma\'lumotini olishda xato',
      });
    }
  }

  /**
   * PUT /api/auth/change-password
   * 
   * Parolni o'zgartirish
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Autentifikatsiya talab qilinadi',
        });
        return;
      }

      const { oldPassword, newPassword } = req.body;

      // Eski parolni tekshirish
      const isOldPasswordValid = await req.user.comparePassword(oldPassword);
      
      if (!isOldPasswordValid) {
        res.status(400).json({
          success: false,
          message: 'Eski parol noto\'g\'ri',
        });
        return;
      }

      // Yangi parolni o'rnatish
      await req.user.update({
        password: newPassword,  // beforeUpdate hook avtomatik hash qiladi
      });

      res.status(200).json({
        success: true,
        message: 'Parol muvaffaqiyatli o\'zgartirildi',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Parolni o\'zgartirishda xato',
      });
    }
  }

  /**
   * GET /api/auth/profile/:id (Admin only)
   * 
   * Boshqa userni olish
   */
  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const user = await authService.getUserById(parseInt(id, 10));

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User topilmadi',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: user.toJSON(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'User ma\'lumotini olishda xato',
      });
    }
  }
}

export default new UserController();