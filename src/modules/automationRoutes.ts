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
 * @swagger
 * /api/automation/init:
 *   post:
 *     summary: Browser ni initialize qilish
 *     description: Playwright browser ni ishga tushirish
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               headless:
 *                 type: boolean
 *                 default: true
 *                 description: Browser headless rejimida ishlasinmi
 *     responses:
 *       200:
 *         description: Browser muvaffaqiyatli ishga tushdi
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
 *                   example: Browser initialized successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Browser ishga tushirishda xato
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Initialization failed
 *                 error:
 *                   type: string
 *                   example: Browser launch error
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
 * @swagger
 * /api/automation/login:
 *   post:
 *     summary: Tax site ga login
 *     description: my3.soliq.uz ga TIN va parol bilan kirish
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tin
 *               - password
 *             properties:
 *               tin:
 *                 type: string
 *                 description: Soliq to'lovchining INN raqami
 *                 example: '123456789'
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Parol
 *                 example: 'password123'
 *               captcha:
 *                 type: string
 *                 description: CAPTCHA kodi (agar kerak bo'lsa)
 *                 example: 'AB12CD'
 *     responses:
 *       200:
 *         description: Login jarayoni yakunlandi
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
 *                   example: Login successful
 *       400:
 *         description: TIN yoki parol kiritilmagan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: TIN va parol kiritilishi shart
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Login xatosi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Login error
 *                 error:
 *                   type: string
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
 * @swagger
 * /api/automation/create-invoice:
 *   post:
 *     summary: Invoice yaratish
 *     description: Tax siteda yangi invoice (faktura) yaratish
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nomer
 *               - sana
 *               - mxik
 *               - tovar_nomi
 *               - miqdori
 *               - narxi
 *             properties:
 *               nomer:
 *                 type: string
 *                 example: FAK-001
 *               sana:
 *                 type: string
 *                 format: date
 *                 example: '2024-12-11'
 *               mxik:
 *                 type: string
 *                 example: '12345678'
 *               tovar_nomi:
 *                 type: string
 *                 example: Dori vositalari
 *               olchov_birligi:
 *                 type: string
 *                 example: dona
 *               miqdori:
 *                 type: number
 *                 example: 100
 *               narxi:
 *                 type: number
 *                 example: 50000
 *     responses:
 *       200:
 *         description: Invoice yaratish jarayoni yakunlandi
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
 *                   example: Invoice created successfully
 *       401:
 *         description: Login qilinmagan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Iltimos avval login qiling
 *       500:
 *         description: Invoice yaratishda xato
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Invoice creation error
 *                 error:
 *                   type: string
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
 * @swagger
 * /api/automation/logout:
 *   post:
 *     summary: Logout
 *     description: Tax sitedan chiqish
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Muvaffaqiyatli logout
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
 *                   example: Logged out successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Logout xatosi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Logout error
 *                 error:
 *                   type: string
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
 * @swagger
 * /api/automation/close:
 *   post:
 *     summary: Browser ni yopish
 *     description: Playwright browser ni to'liq yopish va sessionni tozalash
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Browser muvaffaqiyatli yopildi
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
 *                   example: Browser closed successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Browser yopishda xato
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Close error
 *                 error:
 *                   type: string
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
 * @swagger
 * /api/automation/clear-session:
 *   post:
 *     summary: Session ni tozalash
 *     description: Browser cookies va cache ni tozalash
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Session muvaffaqiyatli tozalandi
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
 *                   example: Session cleared successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Session tozalashda xato
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Clear session error
 *                 error:
 *                   type: string
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
 * @swagger
 * /api/automation/status:
 *   get:
 *     summary: Hozirgi session statusini ko'rish
 *     description: Browser va login holatini tekshirish
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Status muvaffaqiyatli olindi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     initialized:
 *                       type: boolean
 *                       example: true
 *                       description: Browser ishga tushganmi
 *                     loggedIn:
 *                       type: boolean
 *                       example: true
 *                       description: Tax sitega login qilinganmi
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Status tekshirishda xato
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Status check error
 *                 error:
 *                   type: string
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