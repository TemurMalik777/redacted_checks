import { Request, Response } from 'express';
import { User, Import, Check, Faktura, SelectCheck } from '../index';
import { Op } from 'sequelize';

/**
 * Admin Controller
 */
class AdminController {
  /**
   * GET /api/admin/users
   */
  async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
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

      if (role && (role === 'user' || role === 'admin')) {
        whereClause.role = role;
      }

      const { count, rows: users } = await User.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
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
  }

  /**
   * PUT /api/admin/users/:id
   */
  async updateUser(req: Request, res: Response): Promise<void> {
    try {
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
  }

  /**
   * DELETE /api/admin/users/:id
   */
  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
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
  }

  /**
   * GET /api/admin/dashboard/stats
   */
  async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
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
  }

  /**
   * GET /api/admin/imports
   */
  async getAllImports(req: Request, res: Response): Promise<void> {
    try {
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
  }

  /**
   * GET /api/admin/imports/:id
   */
  async getImportDetails(req: Request, res: Response): Promise<void> {
    try {
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
  }
}

export default new AdminController();