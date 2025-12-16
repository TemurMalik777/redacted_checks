import { Request, Response, NextFunction } from 'express';
import authService from './authService';
import { User } from '../modules/index';

// ✅ Express Request type ni kengaytirish
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Authentication Middleware
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Access token topilmadi',
      });
      return;
    }

    const token = authHeader.substring(7);
    const user = await authService.getUserByToken(token);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Token yaroqsiz',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Autentifikatsiya xatosi',
    });
  }
};