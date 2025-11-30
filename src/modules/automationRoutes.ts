import { Router, Request, Response } from 'express';
import { TaxSiteService } from '../automation/taxSiteService';
import { authMiddleware } from '../middlewares/authMiddleware';
import { rateLimiterMiddleware } from '../middlewares/rateLimiterMiddleware';

const router = Router();

// Service instance (singleton)
let taxService: TaxSiteService | null = null;

// Initialize service
router.post('/init', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { headless = true } = req.body;
    
    taxService = new TaxSiteService('user');
    await taxService.initialize(headless);

    res.json({ 
      success: true, 
      message: 'Browser initialized' 
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Initialization failed', 
      details: error.message 
    });
  }
});

// Login
router.post('/login', authMiddleware, rateLimiterMiddleware, async (req: Request, res: Response) => {
  try {
    const { tin, password, captcha } = req.body;

    if (!taxService) {
      taxService = new TaxSiteService('user');
      await taxService.initialize(false);
    }

    const success = await taxService.login({ tin, password, captcha });

    res.json({ 
      success, 
      message: success ? 'Login successful' : 'Login failed' 
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Login error', 
      details: error.message 
    });
  }
});

// Create invoice
router.post('/create-invoice', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!taxService) {
      return res.status(400).json({ 
        error: 'Service not initialized. Call /init first.' 
      });
    }

    const invoiceData = req.body;
    const success = await taxService.createInvoice(invoiceData);

    res.json({ 
      success,
      message: success ? 'Invoice created' : 'Invoice creation failed'
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Invoice creation error', 
      details: error.message 
    });
  }
});

// Logout
router.post('/logout', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (taxService) {
      await taxService.logout();
    }

    res.json({ 
      success: true, 
      message: 'Logged out' 
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Logout error', 
      details: error.message 
    });
  }
});

// Close browser
router.post('/close', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (taxService) {
      await taxService.close();
      taxService = null;
    }

    res.json({ 
      success: true, 
      message: 'Browser closed' 
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Close error', 
      details: error.message 
    });
  }
});

// Clear session
router.post('/clear-session', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (taxService) {
      await taxService.clearSession();
      taxService = null;
    }

    res.json({ 
      success: true, 
      message: 'Session cleared' 
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Clear session error', 
      details: error.message 
    });
  }
});

export default router;