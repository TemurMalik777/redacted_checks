import { Request, Response } from 'express';
import { User, Import, Check, Faktura, SelectCheck } from '../index';
import { Op } from 'sequelize';

/**
 * Admin Controller
 */
class AdminController {
  /**
   * Admin role tekshirish helper metodi
   */
  private checkAdminRole = (req: Request, res: Response): boolean => {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: "Ruxsat yo'q (faqat adminlar uchun)",
      });
      return false;
    }
    return true;
  };

  /**
   * GET /api/admin/users
   */
  getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.checkAdminRole(req, res)) return;

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string || '';
      const role = req.query.role as string;

      const offset = (page - 1) * limit;

      const whereClause: any = {};
      
      if (search) {
        whereClause[Op.or] = [
          { username: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } },
        ];
      }

      if (role && (role === 'admin' || role === 'user')) {
        whereClause.role = role;
      }

      const { count, rows: users } = await User.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
        attributes: { exclude: ['password', 'hashpassword'] },
      });

      res.status(200).json({
        success: true,
        data: {
          users: users.map(u => u.toJSON()),
          pagination: {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
          },
        },
      });
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        message: 'Userlarni olishda xato',
      });
    }
  };

  /**
   * PUT /api/admin/users/:id
   */
  updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.checkAdminRole(req, res)) return;

      const { id } = req.params;
      const { firstName, lastName, email, phone, role, isActive } = req.body;

      const user = await User.findByPk(id);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User topilmadi',
        });
        return;
      }

      await user.update({
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(email && { email }),
        ...(phone && { phone }),
        ...(role && { role }),
        ...(typeof isActive === 'boolean' && { isActive }),
      });

      res.status(200).json({
        success: true,
        message: 'User muvaffaqiyatli tahrirlandi',
        data: {
          user: user.toJSON(),
        },
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({
        success: false,
        message: 'Userni tahrirlashda xato',
      });
    }
  };

  /**
   * DELETE /api/admin/users/:id
   */
  deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.checkAdminRole(req, res)) return;

      const { id } = req.params;

      if (req.user?.id === parseInt(id)) {
        res.status(400).json({
          success: false,
          message: 'O\'zingizni o\'chira olmaysiz',
        });
        return;
      }

      const user = await User.findByPk(id);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User topilmadi',
        });
        return;
      }

      await user.update({ isActive: false });

      res.status(200).json({
        success: true,
        message: 'User muvaffaqiyatli o\'chirildi',
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Userni o\'chirishda xato',
      });
    }
  };

  /**
   * GET /api/admin/dashboard/stats
   */
  getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.checkAdminRole(req, res)) return;

      const [
        totalUsers,
        totalImports,
        totalChecks,
        totalFaktura,
        totalSelectChecks,
        activeSelectChecks,
        pendingSelectChecks,
      ] = await Promise.all([
        User.count(),
        Import.count(),
        Check.count(),
        Faktura.count(),
        SelectCheck.count(),
        SelectCheck.count({ 
          where: { isActive: true } as any 
        }),
        SelectCheck.count({ 
          where: { 
            isActive: false,
            processed: false 
          } as any 
        }),
      ]);

      const recentImports = await Import.findAll({
        limit: 5,
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'firstName', 'lastName'],
          },
        ],
      });

      res.status(200).json({
        success: true,
        data: {
          statistics: {
            users: totalUsers,
            imports: totalImports,
            checks: totalChecks,
            faktura: totalFaktura,
            selectChecks: {
              total: totalSelectChecks,
              active: activeSelectChecks,
              pending: pendingSelectChecks,
            },
          },
          recentImports: recentImports.map(imp => ({
            id: imp.id,
            fileName: imp.fileName,
            status: imp.status,
            totalRows: imp.totalRows,
            importedRows: imp.importedRows,
            failedRows: imp.failedRows,
            successRate: imp.getSuccessRate(),
            user: imp.user,
            createdAt: imp.createdAt,
          })),
        },
      });
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Statistikani olishda xato',
      });
    }
  };

  /**
   * GET /api/admin/imports
   */
  getAllImports = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.checkAdminRole(req, res)) return;

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;

      const offset = (page - 1) * limit;

      const whereClause: any = {};
      if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) {
        whereClause.status = status;
      }

      const { count, rows: imports } = await Import.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'firstName', 'lastName'],
          },
        ],
      });

      res.status(200).json({
        success: true,
        data: {
          imports: imports.map(imp => ({
            id: imp.id,
            fileName: imp.fileName,
            source: imp.source,
            status: imp.status,
            totalRows: imp.totalRows,
            importedRows: imp.importedRows,
            failedRows: imp.failedRows,
            successRate: imp.getSuccessRate(),
            duration: imp.getDuration(),
            user: imp.user,
            startedAt: imp.startedAt,
            finishedAt: imp.finishedAt,
            createdAt: imp.createdAt,
          })),
          pagination: {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
          },
        },
      });
    } catch (error) {
      console.error('Get all imports error:', error);
      res.status(500).json({
        success: false,
        message: 'Importlarni olishda xato',
      });
    }
  };

  /**
   * GET /api/admin/imports/:id
   */
  getImportDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.checkAdminRole(req, res)) return;

      const { id } = req.params;

      const importRecord = await Import.findByPk(id, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'firstName', 'lastName'],
          },
          {
            model: Check,
            as: 'checks',
            limit: 10,
          },
          {
            model: Faktura,
            as: 'fakturas',
            limit: 10,
          },
        ],
      });

      if (!importRecord) {
        res.status(404).json({
          success: false,
          message: 'Import topilmadi',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          import: {
            id: importRecord.id,
            fileName: importRecord.fileName,
            source: importRecord.source,
            status: importRecord.status,
            totalRows: importRecord.totalRows,
            importedRows: importRecord.importedRows,
            failedRows: importRecord.failedRows,
            successRate: importRecord.getSuccessRate(),
            duration: importRecord.getDuration(),
            errorMessage: importRecord.errorMessage,
            user: importRecord.user,
            checks: importRecord.checks,
            fakturas: importRecord.fakturas,
            startedAt: importRecord.startedAt,
            finishedAt: importRecord.finishedAt,
            createdAt: importRecord.createdAt,
          },
        },
      });
    } catch (error) {
      console.error('Get import details error:', error);
      res.status(500).json({
        success: false,
        message: 'Import ma\'lumotini olishda xato',
      });
    }
  };

  /**
   * PUT /api/admin/users/:id/role
   */
  changeUserRole = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.checkAdminRole(req, res)) return;

      const { id } = req.params;
      const { role } = req.body;

      if (!role || (role !== 'user' && role !== 'admin')) {
        res.status(400).json({
          success: false,
          message: 'Role "user" yoki "admin" bo\'lishi kerak',
        });
        return;
      }

      const user = await User.findByPk(id);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User topilmadi',
        });
        return;
      }

      await user.update({ role });

      res.status(200).json({
        success: true,
        message: `User ${role} qilindi`,
        data: { user: user.toJSON() },
      });
    } catch (error) {
      console.error('Change user role error:', error);
      res.status(500).json({
        success: false,
        message: 'Roleni o\'zgartirishda xato',
      });
    }
  };

  /**
   * POST /api/admin/users/:id/block
   */
  blockUser = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.checkAdminRole(req, res)) return;

      const { id } = req.params;
      const user = await User.findByPk(id);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User topilmadi',
        });
        return;
      }

      await user.update({ isActive: false });

      res.status(200).json({
        success: true,
        message: 'User bloklandi',
        data: { user: user.toJSON() },
      });
    } catch (error) {
      console.error('Block user error:', error);
      res.status(500).json({
        success: false,
        message: 'Userni bloklashda xato',
      });
    }
  };

  /**
   * POST /api/admin/users/:id/unblock
   */
  unblockUser = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.checkAdminRole(req, res)) return;

      const { id } = req.params;
      const user = await User.findByPk(id);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User topilmadi',
        });
        return;
      }

      await user.update({ isActive: true });

      res.status(200).json({
        success: true,
        message: 'User aktivlashtirildi',
        data: { user: user.toJSON() },
      });
    } catch (error) {
      console.error('Unblock user error:', error);
      res.status(500).json({
        success: false,
        message: 'Userni aktivlashtirishda xato',
      });
    }
  };

  /**
   * GET /api/admin/admins
   */
  getAllAdmins = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.checkAdminRole(req, res)) return;

      const admins = await User.findAll({
        where: { role: 'admin' },
        attributes: { exclude: ['password', 'hashpassword'] },
        order: [['createdAt', 'DESC']],
      });

      res.status(200).json({
        success: true,
        data: {
          admins: admins.map(a => a.toJSON()),
          total: admins.length,
        },
      });
    } catch (error) {
      console.error('Get all admins error:', error);
      res.status(500).json({
        success: false,
        message: 'Adminlarni olishda xato',
      });
    }
  };
}

export default new AdminController();