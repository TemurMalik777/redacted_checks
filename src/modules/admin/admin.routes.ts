import { Router } from 'express';
import adminController from './admin.controller';
import adminService from './admin.service';
import { authMiddleware, adminOnly } from '../../middlewares/authMiddleware';
import { adminLimiter } from '../../middlewares/rateLimiterMiddleware';
import { Request, Response } from 'express';

const router = Router();

// Barcha admin routelar himoyalangan
router.use(authMiddleware, adminOnly, adminLimiter);

/**
 * Dashboard
 */
router.get('/dashboard/stats', adminController.getDashboardStats);

/**
 * User Management
 */
router.get('/users', adminController.getAllUsers);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

/**
 * Import Management
 */
router.get('/imports', adminController.getAllImports);
router.get('/imports/:id', adminController.getImportDetails);

/**
 * Role Management ✅ YANGI ENDPOINTLAR
 */

/**
 * PUT /api/admin/users/:id/role
 * 
 * User roleni o'zgartirish
 * 
 * Request body:
 * {
 *   "role": "admin" | "user"
 * }
 */
router.put('/users/:id/role', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || (role !== 'user' && role !== 'admin')) {
      res.status(400).json({
        success: false,
        message: 'Role "user" yoki "admin" bo\'lishi kerak',
      });
      return;
    }

    const user = await adminService.changeUserRole(parseInt(id), role);

    res.status(200).json({
      success: true,
      message: `User ${role} qilindi`,
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Xato';
    res.status(500).json({
      success: false,
      message,
    });
  }
});

/**
 * POST /api/admin/users/:id/make-admin
 * 
 * Userni admin qilish
 */
router.post('/users/:id/make-admin', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await adminService.makeAdmin(parseInt(id));

    res.status(200).json({
      success: true,
      message: 'User admin qilindi',
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Xato';
    res.status(500).json({
      success: false,
      message,
    });
  }
});

/**
 * POST /api/admin/users/:id/remove-admin
 * 
 * Admin roleni olib tashlash
 */
router.post('/users/:id/remove-admin', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await adminService.removeAdmin(parseInt(id));

    res.status(200).json({
      success: true,
      message: 'Admin roli olib tashlandi',
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Xato';
    res.status(500).json({
      success: false,
      message,
    });
  }
});

/**
 * POST /api/admin/users/:id/block
 * 
 * Userni bloklash
 */
router.post('/users/:id/block', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await adminService.blockUser(parseInt(id));

    res.status(200).json({
      success: true,
      message: 'User bloklandi',
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Xato';
    res.status(500).json({
      success: false,
      message,
    });
  }
});

/**
 * POST /api/admin/users/:id/unblock
 * 
 * Userni aktivlashtirish
 */
router.post('/users/:id/unblock', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await adminService.unblockUser(parseInt(id));

    res.status(200).json({
      success: true,
      message: 'User aktivlashtirildi',
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Xato';
    res.status(500).json({
      success: false,
      message,
    });
  }
});

/**
 * GET /api/admin/admins
 * 
 * Barcha adminlarni olish
 */
router.get('/admins', async (req: Request, res: Response) => {
  try {
    const admins = await adminService.getAllAdmins();

    res.status(200).json({
      success: true,
      data: {
        admins: admins.map(a => a.toJSON()),
        total: admins.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Adminlarni olishda xato',
    });
  }
});

export default router;