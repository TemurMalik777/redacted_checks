import { Router } from 'express';
import adminController from './admin.controller';
import { authMiddleware, adminOnly } from '../../middlewares/authMiddleware';
import { adminLimiter } from '../../middlewares/rateLimiterMiddleware';

/**
 * Admin Routes
 *
 * Barcha admin panel endpointlari
 * DIQQAT: Barcha routelar authMiddleware + adminOnly bilan himoyalangan!
 */
const router = Router();

// Barcha admin routelar uchun auth + admin check + rate limiting
router.use(authMiddleware, adminOnly, adminLimiter);

/**
 * Dashboard
 */

/**
 * GET /api/admin/dashboard/stats
 *
 * Dashboard statistikasi
 *
 * Response:
 * {
 *   "statistics": {
 *     "users": 10,
 *     "imports": 5,
 *     "checks": 100,
 *     "faktura": 150,
 *     "selectChecks": {
 *       "total": 80,
 *       "active": 30,
 *       "pending": 50
 *     }
 *   },
 *   "recentImports": [...]
 * }
 */
router.get('/dashboard/stats', adminController.getDashboardStats);

/**
 * User Management
 */

/**
 * GET /api/admin/users
 *
 * Barcha userlarni olish
 *
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 20)
 * - search: string (username, email, firstName, lastName bo'yicha qidirish)
 * - role: 'user' | 'admin'
 *
 * Example:
 * GET /api/admin/users?page=1&limit=10&search=john&role=user
 */
router.get('/users', adminController.getAllUsers);

/**
 * PUT /api/admin/users/:id
 *
 * Userni tahrirlash
 *
 * Request body:
 * {
 *   "firstName": "New Name",
 *   "lastName": "New Last Name",
 *   "email": "newemail@example.com",
 *   "phone": "+998901234567",
 *   "role": "admin",
 *   "isActive": true
 * }
 */
router.put('/users/:id', adminController.updateUser);

/**
 * DELETE /api/admin/users/:id
 *
 * Userni o'chirish (soft delete)
 *
 * DIQQAT: O'zini o'chira olmaydi!
 */
router.delete('/users/:id', adminController.deleteUser);

/**
 * Import Management
 */

/**
 * GET /api/admin/imports
 *
 * Barcha importlarni olish
 *
 * Query params:
 * - page: number
 * - limit: number
 * - status: 'pending' | 'processing' | 'completed' | 'failed'
 *
 * Example:
 * GET /api/admin/imports?page=1&status=completed
 */
router.get('/imports', adminController.getAllImports);

/**
 * GET /api/admin/imports/:id
 *
 * Import detallari
 *
 * Import haqida to'liq ma'lumot, shu jumladan:
 * - Import statistikasi
 * - Birinchi 10 ta check
 * - Birinchi 10 ta faktura
 */
router.get('/imports/:id', adminController.getImportDetails);

export default router;
