import { Router, Request, Response } from 'express';
import { TaxSiteService } from '../automation/taxSiteSelectors';
import { authMiddleware } from '../middlewares/authMiddleware';
import { automationLimiter } from '../middlewares/rateLimiterMiddleware';

const router = Router();

/**
 * Service instance (singleton pattern)
 * Har bir session uchun bitta instance
 */
const sessions = new Map<string, TaxSiteService>();

/**
 * Helper: Session key yaratish
 */
const getSessionKey = (req: Request): string => {
  return `session_${req.user?.id || 'guest'}`;
};

/**
 * Helper: Session olish yoki yaratish
 */
const getOrCreateSession = (req: Request): TaxSiteService => {
  const key = getSessionKey(req);
  
  if (!sessions.has(key)) {
    sessions.set(key, new TaxSiteService());
  }
  
  return sessions.get(key)!;
};

/**
 * POST /api/automation/init
 * 
 * Browser ni initialize qilish
 */
router.post('/init', authMiddleware, automationLimiter, async (req: Request, res: Response) => {
  try {
    const { headless = true } = req.body;
    
    const service = getOrCreateSession(req);
    await service.initialize(headless);

    res.json({ 
      success: true, 
      message: 'Browser initialized successfully',
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Initialization failed', 
      error: error.message,
    });
  }
});

/**
 * POST /api/automation/login
 * 
 * Tax site ga login
 */
router.post('/login', authMiddleware, automationLimiter, async (req: Request, res: Response) => {
  try {
    const { tin, password, captcha } = req.body;

    if (!tin || !password) {
      return res.status(400).json({
        success: false,
        message: 'TIN va parol kiritilishi shart',
      });
    }

    const service = getOrCreateSession(req);
    
    // Agar browser init qilinmagan bo'lsa, avtomatik init qilish
    const isLoggedIn = await service.isLoggedIn();
    if (!isLoggedIn) {
      await service.initialize(false);
    }

    const success = await service.login({ tin, password, captcha });

    res.json({ 
      success, 
      message: success ? 'Login successful' : 'Login failed',
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Login error', 
      error: error.message,
    });
  }
});

/**
 * POST /api/automation/create-invoice
 * 
 * Invoice yaratish
 */
router.post('/create-invoice', authMiddleware, automationLimiter, async (req: Request, res: Response) => {
  try {
    const service = getOrCreateSession(req);
    
    // Login tekshirish
    const isLoggedIn = await service.isLoggedIn();
    if (!isLoggedIn) {
      return res.status(401).json({ 
        success: false,
        message: 'Iltimos avval login qiling',
      });
    }

    const invoiceData = req.body;
    const success = await service.createInvoice(invoiceData);

    res.json({ 
      success,
      message: success ? 'Invoice created successfully' : 'Invoice creation failed',
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Invoice creation error', 
      error: error.message,
    });
  }
});

/**
 * POST /api/automation/logout
 * 
 * Logout
 */
router.post('/logout', authMiddleware, async (req: Request, res: Response) => {
  try {
    const service = getOrCreateSession(req);
    await service.logout();

    res.json({ 
      success: true, 
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Logout error', 
      error: error.message,
    });
  }
});

/**
 * POST /api/automation/close
 * 
 * Browser ni yopish
 */
router.post('/close', authMiddleware, async (req: Request, res: Response) => {
  try {
    const key = getSessionKey(req);
    const service = sessions.get(key);
    
    if (service) {
      await service.close();
      sessions.delete(key);
    }

    res.json({ 
      success: true, 
      message: 'Browser closed successfully',
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Close error', 
      error: error.message,
    });
  }
});

/**
 * POST /api/automation/clear-session
 * 
 * Session ni tozalash (cookies, cache)
 */
router.post('/clear-session', authMiddleware, async (req: Request, res: Response) => {
  try {
    const key = getSessionKey(req);
    const service = sessions.get(key);
    
    if (service) {
      await service.clearSession();
      sessions.delete(key);
    }

    res.json({ 
      success: true, 
      message: 'Session cleared successfully',
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Clear session error', 
      error: error.message,
    });
  }
});

/**
 * GET /api/automation/status
 * 
 * Hozirgi session statusini ko'rish
 */
router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const key = getSessionKey(req);
    const service = sessions.get(key);
    
    if (!service) {
      return res.json({
        success: true,
        data: {
          initialized: false,
          loggedIn: false,
        },
      });
    }

    const isLoggedIn = await service.isLoggedIn();

    res.json({
      success: true,
      data: {
        initialized: true,
        loggedIn: isLoggedIn,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Status check error',
      error: error.message,
    });
  }
});

export default router;