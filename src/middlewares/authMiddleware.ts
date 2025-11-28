import { Request, Response, NextFunction } from 'express';
import authService from './authService';

/**
 * Authentication Middleware
 * Access token ni tekshiradi va req.user ga user obyektini qo'shadi
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Header dan token olish
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Access token topilmadi',
      });
      return;
    }

    const token = authHeader.substring(7); // "Bearer " ni olib tashlash

    // 2. Token ni verify qilish va userni olish
    const user = await authService.getUserByToken(token);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Token yaroqsiz yoki muddati tugagan',
      });
      return;
    }

    // 3. User ni request ga qo'shish
    req.user = user;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Autentifikatsiya xatosi',
    });
  }
};

/**
 * Admin Only Middleware
 * Faqat admin userlar kirishini tekshiradi
 */
export const adminOnly = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Autentifikatsiya talab qilinadi',
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Bu amalni bajarish uchun admin huquqi kerak',
    });
    return;
  }

  next();
};