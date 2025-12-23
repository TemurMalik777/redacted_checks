import { Request, Response, NextFunction } from 'express';
import { sessionStore } from '../services/sessionStore';

/**
 * Session mavjudligini tekshirish middleware
 */
export const checkActiveSession = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Foydalanuvchi autentifikatsiya qilinmagan',
      });
    }

    const hasSession = await sessionStore.exists(userId);

    if (hasSession) {
      return res.status(400).json({
        success: false,
        message: 'Avtomatizatsiya allaqachon ishlamoqda',
        code: 'SESSION_ALREADY_EXISTS',
      });
    }

    next();
  } catch (error) {
    console.error('Session check error:', error);
    res.status(500).json({
      success: false,
      message: 'Session tekshirishda xato',
    });
  }
};

/**
 * Session majburiy bo'lishi kerak
 */
export const requireSession = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Foydalanuvchi autentifikatsiya qilinmagan',
      });
    }

    const session = await sessionStore.get(userId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Faol session topilmadi',
        code: 'SESSION_NOT_FOUND',
      });
    }

    // Session ma'lumotlarini request ga qo'shish
    req.session = session;
    next();
  } catch (error) {
    console.error('Session requirement error:', error);
    res.status(500).json({
      success: false,
      message: 'Session tekshirishda xato',
    });
  }
};

// Type extension
declare global {
  namespace Express {
    interface Request {
      session?: import('../types/session.types').SessionData;
    }
  }
}
