import { Request, Response, NextFunction } from 'express';
import authService from './authService';
import { User } from '../modules/index';

/**
 * Request obyektiga user qo'shish uchun interfeys
 * 
 * TypeScript da Request obyektiga custom property qo'shish uchun
 * bu yondashuv ishlatiladi
 */
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Authentication Middleware
 * 
 * Bu middleware har bir protected route uchun ishlatiladi
 * JWT token ni tekshiradi va request ga user obyektini qo'shadi
 * 
 * FOYDALANISH:
 * app.get('/protected-route', authMiddleware, (req, res) => {
 *   // req.user mavjud
 * });
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Token ni headerdan olish
    // Format: "Bearer <token>"
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Token topilmadi. Iltimos login qiling.',
      });
      return;
    }

    // "Bearer " ni olib tashlash
    const token = authHeader.substring(7);

    // 2. Token ni verify qilish va userni topish
    const user = await authService.getUserByToken(token);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Token yaroqsiz yoki muddati o\'tgan.',
      });
      return;
    }

    // 3. User obyektini request ga qo'shish
    req.user = user;

    // 4. Keyingi middleware ga o'tish
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Token tekshirishda xato',
    });
  }
};

/**
 * Role Check Middleware Factory
 * 
 * Bu funksiya berilgan role(lar) uchun middleware yaratadi
 * 
 * FOYDALANISH:
 * app.get('/admin-only', authMiddleware, requireRole('admin'), (req, res) => {
 *   // Faqat adminlar kirishi mumkin
 * });
 * 
 * app.get('/user-or-admin', authMiddleware, requireRole(['user', 'admin']), (req, res) => {
 *   // User yoki admin kirishi mumkin
 * });
 */
export const requireRole = (roles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // authMiddleware avval ishlab, req.user ni qo'shgan bo'lishi kerak
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Autentifikatsiya talab qilinadi',
      });
      return;
    }

    // Roles ni array ga aylantirish
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    // User role ni tekshirish
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Sizda bu amalni bajarish uchun ruxsat yo\'q',
        requiredRoles: allowedRoles,
        yourRole: req.user.role,
      });
      return;
    }

    // Role to'g'ri - davom etish
    next();
  };
};

/**
 * Admin Only Middleware
 * 
 * Faqat adminlar uchun shorthand
 * 
 * FOYDALANISH:
 * app.get('/admin-panel', authMiddleware, adminOnly, (req, res) => {
 *   // Faqat adminlar
 * });
 */
export const adminOnly = requireRole('admin');

/**
 * Optional Auth Middleware
 * 
 * Token bo'lsa - verify qiladi, yo'q bo'lsa - davom etadi
 * 
 * Public endpointlar uchun foydali, agar user login qilgan bo'lsa,
 * personalized ma'lumot ko'rsatish mumkin
 * 
 * FOYDALANISH:
 * app.get('/public-data', optionalAuth, (req, res) => {
 *   if (req.user) {
 *     // Login qilgan user
 *   } else {
 *     // Mehmon
 *   }
 * });
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = await authService.getUserByToken(token);
      
      if (user) {
        req.user = user;
      }
    }

    // Token yo'q yoki yaroqsiz bo'lsa ham davom etadi
    next();
  } catch (error) {
    // Xato bo'lsa ham davom etadi
    next();
  }
};