import { Request, Response } from 'express';
import authService from '../../middlewares/authService';

/**
 * IP address ni olish helper function
 */
const getIpAddress = (req: Request): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

/**
 * Cookie sozlamalari
 */
const getCookieOptions = () => {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    REFRESH_TOKEN_EXPIRES_IN : 7 * 24 * 60 * 60 * 1000, // 7 kun
  };
};

/**
 * User Controller
 */
class UserController {
  /**
   * POST /api/auth/register
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const ipAddress = getIpAddress(req);
      const { user, accessToken, refreshToken } = await authService.register(
        req.body,
        ipAddress,
      );

      // Refresh token ni cookie ga saqlash
      res.cookie('refreshToken', refreshToken, getCookieOptions());

      res.status(201).json({
        success: true,
        message: "Muvaffaqiyatli ro'yxatdan o'tdingiz!",
        data: {
          user: user.toJSON(),
          accessToken,
        },
      });
    } catch (error) {
      let statusCode = 500;
      let message = "Ro'yxatdan o'tishda xato";
      
      if (error instanceof Error) {
        message = error.message;
    
    // Validation xatolari uchun 400
    if (message.includes('mavjud') || message.includes('noto\'g\'ri')) {
      statusCode = 400;
    }
    // Conflict xatolari uchun 409
    else if (message.includes('allaqachon')) {
      statusCode = 409;
    }
  }
  
      res.status(statusCode).json({
        success: false,
        message,
      });
    }
  }
  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const ipAddress = getIpAddress(req);
      const { user, accessToken, refreshToken } = await authService.login(
        req.body,
        ipAddress,
      );

      // Refresh token ni cookie ga saqlash
      res.cookie('refreshToken', refreshToken, getCookieOptions());

      res.status(200).json({
        success: true,
        message: 'Muvaffaqiyatli login qildingiz!',
        data: {
          user: user.toJSON(),
          accessToken,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Login qilishda xato';

      res.status(401).json({
        success: false,
        message,
      });
    }
  }

  /**
   * POST /api/auth/refresh
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const oldRefreshToken = req.cookies.refreshToken;

      if (!oldRefreshToken) {
        res.status(401).json({
          success: false,
          message: 'Refresh token topilmadi',
        });
        return;
      }

      const ipAddress = getIpAddress(req);
      const { accessToken, refreshToken } =
        await authService.refreshAccessToken(oldRefreshToken, ipAddress);

      // Yangi refresh token ni cookie ga saqlash
      res.cookie('refreshToken', refreshToken, getCookieOptions());

      res.status(200).json({
        success: true,
        message: 'Token muvaffaqiyatli yangilandi',
        data: {
          accessToken,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Token yangilashda xato';

      // Cookie ni o'chirish
      res.clearCookie('refreshToken');

      res.status(401).json({
        success: false,
        message,
      });
    }
  }

  /**
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies.refreshToken;
      const ipAddress = getIpAddress(req);

      if (refreshToken) {
        await authService.logout(refreshToken, ipAddress);
      }

      // Cookie ni o'chirish
      res.clearCookie('refreshToken');

      res.status(200).json({
        success: true,
        message: 'Muvaffaqiyatli logout qildingiz',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Logout qilishda xato',
      });
    }
  }

  /**
   * POST /api/auth/logout-all
   */
  async logoutAll(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Autentifikatsiya talab qilinadi',
        });
        return;
      }

      const ipAddress = getIpAddress(req);
      await authService.logoutAll(req.user.id, ipAddress);

      // Cookie ni o'chirish
      res.clearCookie('refreshToken');

      res.status(200).json({
        success: true,
        message: 'Barcha qurilmalardan muvaffaqiyatli chiqildi',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Logout qilishda xato',
      });
    }
  }

  /**
   * GET /api/auth/me
   */
  async getMe(req: Request, res: Response): Promise<void> {
    try {
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
        message: "User ma'lumotini olishda xato",
      });
    }
  }

  /**
   * PUT /api/auth/change-password
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    try {      
      const { oldPassword, newPassword } = req.body;

      const isOldPasswordValid = await req.user.comparePassword(oldPassword);
      if (!isOldPasswordValid) {
        res.status(401).json({
          success: false,
          message: "Eski parol noto'g'ri",
        });
        return;
      }
      

      if (!isOldPasswordValid) {
        res.status(400).json({
          success: false,
          message: "Eski parol noto'g'ri",
        });
        return;
      }

      await req.user.update({
        hashpassword: newPassword,
      });

      res.status(200).json({
        success: true,
        message: "Parol muvaffaqiyatli o'zgartirildi",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Parolni o'zgartirishda xato",
      });
    }
  }

  /**
   * GET /api/auth/profile/:id
   */
  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const requestedId = parseInt(id, 10);

      // ❌ Agar user authentifikatsiya qilinmagan bo'lsa
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Autentifikatsiya talab qilinadi',
        });
        return;
      }

      // ❌ Agar user boshqa userning profilini ko'rmoqchi bo'lsa
      if (req.user.id !== requestedId && req.user.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Bu profil sizga tegishli emas',
        });
        return;
      }

      // ✅ Agar o'z profili yoki admin bo'lsa
      const user = await authService.getUserById(requestedId);

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
        message: "User ma'lumotini olishda xato",
      });
    }
  }
}
export default new UserController();
