import { Router } from 'express';
import { automationController } from './automation.controller';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { automationLimiter } from '../../middlewares/rateLimiterMiddleware';
import { checkActiveSession, requireSession } from '../../middlewares/sessionMiddleware';

const router = Router();

/**
 * @swagger
 * /api/automation/init:
 *   post:
 *     summary: Browser ni initialize qilish va session boshlash
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/init',
  authMiddleware,
  checkActiveSession,
  automationLimiter,
  automationController.initializeBrowser.bind(automationController)
);

/**
 * @swagger
 * /api/automation/login:
 *   post:
 *     summary: Tax site ga login
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/login',
  authMiddleware,
  requireSession,
  automationLimiter,
  automationController.login.bind(automationController)
);

/**
 * @swagger
 * /api/automation/create-invoice:
 *   post:
 *     summary: Invoice yaratish
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/create-invoice',
  authMiddleware,
  requireSession,
  automationLimiter,
  automationController.createInvoice.bind(automationController)
);

/**
 * @swagger
 * /api/automation/logout:
 *   post:
 *     summary: Logout
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/logout',
  authMiddleware,
  requireSession,
  automationController.logout.bind(automationController)
);

/**
 * @swagger
 * /api/automation/close:
 *   post:
 *     summary: Browser va sessionni yopish
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/close',
  authMiddleware,
  automationController.closeSession.bind(automationController)
);

/**
 * @swagger
 * /api/automation/status:
 *   get:
 *     summary: Session statusini olish
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  '/status',
  authMiddleware,
  automationController.getStatus.bind(automationController)
);

/**
 * @swagger
 * /api/automation/sessions/all:
 *   get:
 *     summary: Barcha sessionlarni olish
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  '/sessions/all',
  authMiddleware,
  automationController.getAllSessions.bind(automationController)
);

/**
 * @swagger
 * /api/automation/session/refresh:
 *   post:
 *     summary: Session TTL ni yangilash
 *     tags: [Automation]
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/session/refresh',
  authMiddleware,
  requireSession,
  automationController.refreshSession.bind(automationController)
);

export default router;