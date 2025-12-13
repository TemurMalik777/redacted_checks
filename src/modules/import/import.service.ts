import { Op, WhereOptions } from 'sequelize';
import Import, { ImportAttributes, ImportCreationAttributes } from './import.model';

/**
 * ImportService - Ma'lumotlar bazasi bilan ishlash
 */
export class ImportService {
  /**
   * Barcha import'larni olish (pagination + filtering)
   */
  async getAll(filters: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    processed?: boolean;
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    source?: 'excel' | 'manual';
    importedBy?: number;
    search?: string;
    sortBy?: string;
    order?: 'ASC' | 'DESC';
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    const {
      page = 1,
      limit = 20,
      isActive,
      processed,
      status,
      source,
      importedBy,
      search,
      sortBy = 'createdAt',
      order = 'DESC',
      dateFrom,
      dateTo,
    } = filters;

    const offset = (page - 1) * limit;

    // Where conditions array
    const whereConditions: WhereOptions<ImportAttributes>[] = [];

    // Basic filters
    if (typeof isActive === 'boolean') {
      whereConditions.push({ isActive });
    }

    if (typeof processed === 'boolean') {
      whereConditions.push({ processed });
    }

    if (status) {
      whereConditions.push({ status });
    }

    if (source) {
      whereConditions.push({ source });
    }

    if (importedBy) {
      whereConditions.push({ importedBy });
    }

    // Search - fileName yoki errorMessage bo'yicha
    if (search) {
      whereConditions.push({
        [Op.or]: [
          { fileName: { [Op.iLike]: `%${search}%` } },
          { errorMessage: { [Op.iLike]: `%${search}%` } },
        ],
      } as any);
    }

    // Date range
    if (dateFrom && dateTo) {
      whereConditions.push({
        createdAt: {
          [Op.between]: [dateFrom, dateTo],
        },
      });
    } else if (dateFrom) {
      whereConditions.push({
        createdAt: {
          [Op.gte]: dateFrom,
        },
      });
    } else if (dateTo) {
      whereConditions.push({
        createdAt: {
          [Op.lte]: dateTo,
        },
      });
    }

    // Ma'lumotlarni olish
    const { count, rows } = await Import.findAndCountAll({
      where: whereConditions.length > 0 ? { [Op.and]: whereConditions } : {},
      limit,
      offset,
      order: [[sortBy, order]],
    });

    return {
      data: rows,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Bitta import'ni ID bo'yicha olish
   */
  async getById(id: number) {
    const importRecord = await Import.findByPk(id);

    if (!importRecord) {
      throw new Error('Import topilmadi');
    }

    return importRecord;
  }

  /**
   * UUID bo'yicha olish
   */
  async getByUuid(uuid: string) {
    const importRecord = await Import.findOne({
      where: { uuid },
    });

    if (!importRecord) {
      throw new Error('Import topilmadi');
    }

    return importRecord;
  }

  /**
   * User'ning barcha import'larini olish
   */
  async getByUser(userId: number, limit: number = 20) {
    const imports = await Import.findAll({
      where: { importedBy: userId },
      limit,
      order: [['createdAt', 'DESC']],
    });

    return imports;
  }

  /**
   * Yangi import yaratish
   */
  async create(data: ImportCreationAttributes) {
    const importRecord = await Import.create(data);
    return importRecord;
  }

  /**
   * Import'ni yangilash
   */
  async update(id: number, data: Partial<ImportCreationAttributes>) {
    const importRecord = await this.getById(id);

    await importRecord.update(data);
    return importRecord;
  }

  /**
   * Import'ni o'chirish
   */
  async delete(id: number) {
    const importRecord = await this.getById(id);
    await importRecord.destroy();
    return { message: "Import o'chirildi" };
  }

  /**
   * Ko'p import'larni o'chirish
   */
  async bulkDelete(ids: number[]) {
    const deletedCount = await Import.destroy({
      where: {
        id: {
          [Op.in]: ids,
        },
      },
    });

    return {
      deletedCount,
      message: `${deletedCount} ta import o'chirildi`,
    };
  }

  /**
   * Import'ni boshlash (status'ni processing ga o'zgartirish)
   */
  async startImport(id: number) {
    const importRecord = await this.getById(id);
    
    importRecord.status = 'processing';
    importRecord.startedAt = new Date();
    
    await importRecord.save();
    return importRecord;
  }

  /**
   * Import'ni tugallash
   */
  async completeImport(id: number, stats: {
    importedRows: number;
    failedRows: number;
    errorMessage?: string;
  }) {
    const importRecord = await this.getById(id);
    
    importRecord.status = stats.failedRows > 0 ? 'failed' : 'completed';
    importRecord.processed = true;
    importRecord.importedRows = stats.importedRows;
    importRecord.failedRows = stats.failedRows;
    importRecord.finishedAt = new Date();
    
    if (stats.errorMessage) {
      importRecord.errorMessage = stats.errorMessage;
    }
    
    await importRecord.save();
    return importRecord;
  }

  /**
   * Import'ni xato bilan tugallash
   */
  async failImport(id: number, errorMessage: string) {
    const importRecord = await this.getById(id);
    
    importRecord.status = 'failed';
    importRecord.errorMessage = errorMessage;
    importRecord.finishedAt = new Date();
    
    await importRecord.save();
    return importRecord;
  }

  /**
   * Import'ni qayta boshlash (retry)
   */
  async retryImport(id: number) {
    const importRecord = await this.getById(id);
    
    // Faqat failed import'larni retry qilish mumkin
    if (importRecord.status !== 'failed') {
      throw new Error("Faqat failed import'larni qayta boshlash mumkin");
    }
    
    importRecord.status = 'pending';
    importRecord.processed = false;
    importRecord.errorMessage = undefined;
    importRecord.importedRows = 0;
    importRecord.failedRows = 0;
    importRecord.startedAt = undefined;
    importRecord.finishedAt = undefined;
    
    await importRecord.save();
    return importRecord;
  }

  /**
   * Import'ni bekor qilish (cancel)
   */
  async cancelImport(id: number) {
    const importRecord = await this.getById(id);
    
    // Faqat pending yoki processing holatdagi import'larni bekor qilish mumkin
    if (!['pending', 'processing'].includes(importRecord.status)) {
      throw new Error("Faqat pending/processing import'larni bekor qilish mumkin");
    }
    
    importRecord.status = 'failed';
    importRecord.errorMessage = 'Import bekor qilindi';
    importRecord.finishedAt = new Date();
    
    await importRecord.save();
    return importRecord;
  }

  /**
   * Active import'larni olish (processing holatda)
   */
  async getActiveImports(limit: number = 10) {
    const imports = await Import.findAll({
      where: {
        status: 'processing',
        isActive: true,
      },
      limit,
      order: [['startedAt', 'ASC']],
    });

    return imports;
  }

  /**
   * Pending import'larni olish
   */
  async getPendingImports(limit: number = 10) {
    const imports = await Import.findAll({
      where: {
        status: 'pending',
        isActive: true,
      },
      limit,
      order: [['createdAt', 'ASC']],
    });

    return imports;
  }

  /**
   * Failed import'larni olish
   */
  async getFailedImports(limit: number = 20) {
    const imports = await Import.findAll({
      where: {
        status: 'failed',
        errorMessage: { [Op.not]: null },
      },
      limit,
      order: [['finishedAt', 'DESC']],
    });

    return imports;
  }

  /**
   * Statistika
   */
  async getStatistics(userId?: number) {
    const whereCondition = userId ? { importedBy: userId } : {};

    const total = await Import.count({ where: whereCondition });

    const byStatus = await Import.findAll({
      attributes: [
        'status',
        [Import.sequelize!.fn('COUNT', Import.sequelize!.col('id')), 'count'],
      ],
      where: whereCondition,
      group: ['status'],
      raw: true,
    });

    const bySource = await Import.findAll({
      attributes: [
        'source',
        [Import.sequelize!.fn('COUNT', Import.sequelize!.col('id')), 'count'],
      ],
      where: whereCondition,
      group: ['source'],
      raw: true,
    });

    const processed = await Import.count({
      where: { ...whereCondition, processed: true },
    });

    const pending = await Import.count({
      where: { ...whereCondition, status: 'pending' },
    });

    const failed = await Import.count({
      where: { ...whereCondition, status: 'failed' },
    });

    // Jami import qilingan qatorlar
    const totalRowsImported = await Import.sum('importedRows', {
      where: whereCondition,
    });

    const totalRowsFailed = await Import.sum('failedRows', {
      where: whereCondition,
    });

    // O'rtacha success rate
    const allImports = await Import.findAll({
      attributes: ['totalRows', 'importedRows'],
      where: { ...whereCondition, totalRows: { [Op.gt]: 0 } },
      raw: true,
    });

    const avgSuccessRate = allImports.length > 0
      ? Math.round(
          allImports.reduce((sum, imp: any) => {
            return sum + (imp.importedRows / imp.totalRows) * 100;
          }, 0) / allImports.length
        )
      : 0;

    return {
      total,
      processed,
      pending,
      failed,
      totalRowsImported: totalRowsImported || 0,
      totalRowsFailed: totalRowsFailed || 0,
      avgSuccessRate,
      byStatus: byStatus.reduce((acc: any, item: any) => {
        acc[item.status] = parseInt(item.count);
        return acc;
      }, {}),
      bySource: bySource.reduce((acc: any, item: any) => {
        acc[item.source] = parseInt(item.count);
        return acc;
      }, {}),
    };
  }

  /**
   * User statistikasi
   */
  async getUserStatistics(userId: number) {
    return this.getStatistics(userId);
  }

  /**
   * Sana oralig'idagi import'larni olish
   */
  async getByDateRange(startDate: Date, endDate: Date, userId?: number) {
    const whereCondition: any = {
      createdAt: {
        [Op.between]: [startDate, endDate],
      },
    };

    if (userId) {
      whereCondition.importedBy = userId;
    }

    const imports = await Import.findAll({
      where: whereCondition,
      order: [['createdAt', 'DESC']],
    });

    return imports;
  }

  /**
   * Oxirgi N ta import'ni olish
   */
  async getRecent(limit: number = 10, userId?: number) {
    const whereCondition = userId ? { importedBy: userId } : {};

    const imports = await Import.findAll({
      where: whereCondition,
      limit,
      order: [['createdAt', 'DESC']],
    });

    return imports;
  }

  /**
   * isActive'ni o'zgartirish (toggle)
   */
  async toggleActive(id: number) {
    const importRecord = await this.getById(id);
    importRecord.isActive = !importRecord.isActive;
    await importRecord.save();
    return importRecord;
  }

  /**
   * Barcha import'larni o'chirish (ehtiyot bo'ling!)
   */
  async deleteAll(userId?: number) {
    const whereCondition = userId ? { importedBy: userId } : {};

    const deletedCount = await Import.destroy({
      where: whereCondition,
    });

    return {
      deletedCount,
      message: `${deletedCount} ta import o'chirildi`,
    };
  }
}