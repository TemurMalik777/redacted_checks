import { Op, WhereOptions } from 'sequelize';
import SelectCheck, {
  SelectCheckAttributes,
  SelectCheckCreationAttributes,
} from './selectChecks.model';

/**
 * SelectChecksService - Ma'lumotlar bazasi bilan ishlash
 */
export class SelectChecksService {
  /**
   * Barcha select_checks'larni olish (pagination + filtering)
   */
  async getAll(filters: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    processed?: boolean;
    automationStatus?: 'pending' | 'processing' | 'completed' | 'failed';
    search?: string;
    sortBy?: string;
    order?: 'ASC' | 'DESC';
  }) {
    const {
      page = 1,
      limit = 20,
      isActive,
      processed,
      automationStatus,
      search,
      sortBy = 'createdAt',
      order = 'DESC',
    } = filters;

    const offset = (page - 1) * limit;

    // Where conditions - to'g'ri type
    const where: any = {};

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (typeof processed === 'boolean') {
      where.processed = processed;
    }

    if (automationStatus) {
      where.automationStatus = automationStatus;
    }

    // Search - maxsulotNomi, chekRaqam, mxik bo'yicha
    if (search) {
      where[Op.or] = [
        { maxsulotNomi: { [Op.iLike]: `%${search}%` } },
        { chekRaqam: { [Op.iLike]: `%${search}%` } },
        { mxik: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Ma'lumotlarni olish
    const { count, rows } = await SelectCheck.findAndCountAll({
      where,
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
   * Bitta select_check'ni ID bo'yicha olish
   */
  async getById(id: number) {
    const selectCheck = await SelectCheck.findByPk(id);

    if (!selectCheck) {
      throw new Error('SelectCheck topilmadi');
    }

    return selectCheck;
  }

  /**
   * UUID bo'yicha olish
   */
  async getByUuid(uuid: string) {
    const selectCheck = await SelectCheck.findOne({
      where: { uuid },
    });

    if (!selectCheck) {
      throw new Error('SelectCheck topilmadi');
    }

    return selectCheck;
  }

  /**
   * Check raqami bo'yicha olish
   */
  async getByCheckNumber(chekRaqam: string) {
    const selectChecks = await SelectCheck.findAll({
      where: { chekRaqam },
    });

    return selectChecks;
  }

  /**
   * MXIK bo'yicha olish
   */
  async getByMxik(mxik: string) {
    const selectChecks = await SelectCheck.findAll({
      where: { mxik },
    });

    return selectChecks;
  }

  /**
   * Yangi select_check yaratish
   */
  async create(data: SelectCheckCreationAttributes) {
    const selectCheck = await SelectCheck.create(data);
    return selectCheck;
  }

  /**
   * Ko'p select_check'larni bir vaqtda yaratish
   */
  async bulkCreate(dataArray: SelectCheckCreationAttributes[]) {
    const selectChecks = await SelectCheck.bulkCreate(dataArray, {
      validate: true,
      returning: true,
    });

    return {
      data: selectChecks,
      count: selectChecks.length,
      message: `${selectChecks.length} ta select_check yaratildi`,
    };
  }

  /**
   * Select_check'ni yangilash
   */
  async update(id: number, data: Partial<SelectCheckCreationAttributes>) {
    const selectCheck = await this.getById(id);

    await selectCheck.update(data);
    return selectCheck;
  }

  /**
   * Select_check'ni o'chirish
   */
  async delete(id: number) {
    const selectCheck = await this.getById(id);
    await selectCheck.destroy();
    return { message: "SelectCheck o'chirildi" };
  }

  /**
   * Ko'p select_check'larni o'chirish
   */
  async bulkDelete(ids: number[]) {
    const deletedCount = await SelectCheck.destroy({
      where: {
        id: {
          [Op.in]: ids,
        },
      },
    });

    return {
      deletedCount,
      message: `${deletedCount} ta select_check o'chirildi`,
    };
  }

  /**
   * Ko'p select_check'larning holatini yangilash
   */
  async bulkUpdateStatus(
    ids: number[],
    automationStatus: 'pending' | 'processing' | 'completed' | 'failed',
  ) {
    const [updatedCount] = await SelectCheck.update(
      { automationStatus },
      {
        where: {
          id: {
            [Op.in]: ids,
          },
        },
      },
    );

    return {
      updatedCount,
      message: `${updatedCount} ta select_check holati yangilandi`,
    };
  }

  /**
   * isActive'ni o'zgartirish (toggle)
   */
  async toggleActive(id: number) {
    const selectCheck = await this.getById(id);
    selectCheck.isActive = !selectCheck.isActive;
    await selectCheck.save();
    return selectCheck;
  }

  /**
   * Processed'ni true qilish
   */
  async markAsProcessed(id: number) {
    const selectCheck = await this.getById(id);
    selectCheck.processed = true;
    selectCheck.automationStatus = 'completed';
    await selectCheck.save();
    return selectCheck;
  }

  /**
   * Automation uchun tayyor record'larni olish
   */
  async getReadyForAutomation(limit: number = 10) {
    const selectChecks = await SelectCheck.findAll({
      where: {
        isActive: false,
        processed: false,
        chekRaqam: { [Op.not]: null },
        mxik: { [Op.not]: null },
        miqdor: { [Op.gt]: 0 },
        fakturaSumma: { [Op.gt]: 0 },
      },
      limit,
      order: [['createdAt', 'ASC']],
    });

    return selectChecks;
  }

  /**
   * Xatolik bilan yakunlangan record'larni olish
   */
  async getFailedRecords(limit: number = 20) {
    const selectChecks = await SelectCheck.findAll({
      where: {
        automationStatus: 'failed',
        // ✅ TUZATILDI: Op.ne → Op.not
        errorMessage: { [Op.not]: null },
      },
      limit,
      order: [['updatedAt', 'DESC']],
    });

    return selectChecks;
  }

  /**
   * Error message'ni yangilash
   */
  async setError(id: number, errorMessage: string) {
    const selectCheck = await this.getById(id);
    selectCheck.automationStatus = 'failed';
    selectCheck.errorMessage = errorMessage;
    await selectCheck.save();
    return selectCheck;
  }

  /**
   * Error'ni tozalash va qayta urinish uchun tayyor qilish
   */
  async resetForRetry(id: number) {
    const selectCheck = await this.getById(id);
    selectCheck.automationStatus = 'pending';
    selectCheck.errorMessage = undefined;
    selectCheck.processed = false;
    await selectCheck.save();
    return selectCheck;
  }

  /**
   * Ko'p record'larni qayta urinish uchun reset qilish
   */
  async bulkResetForRetry(ids: number[]) {
    const [updatedCount] = await SelectCheck.update(
      {
        automationStatus: 'pending',
        errorMessage: undefined,
        processed: false,
      },
      {
        where: {
          id: { [Op.in]: ids },
        },
      },
    );

    return {
      updatedCount,
      message: `${updatedCount} ta select_check qayta urinish uchun tayyor`,
    };
  }

  /**
   * Statistika
   */
  async getStatistics() {
    const total = await SelectCheck.count();

    const byStatus = await SelectCheck.findAll({
      attributes: [
        'automationStatus',
        [
          SelectCheck.sequelize!.fn('COUNT', SelectCheck.sequelize!.col('id')),
          'count',
        ],
      ],
      group: ['automationStatus'],
      raw: true,
    });

    const active = await SelectCheck.count({ where: { isActive: true } });
    const processed = await SelectCheck.count({ where: { processed: true } });
    const pending = await SelectCheck.count({
      where: { automationStatus: 'pending' },
    });
    const failed = await SelectCheck.count({
      where: { automationStatus: 'failed' },
    });

    // Umumiy summa hisobi
    const totalSum = await SelectCheck.sum('umumiyChekSumma');
    const totalFakturaSum = await SelectCheck.sum('fakturaSumma');

    return {
      total,
      active,
      processed,
      pending,
      failed,
      totalSum: totalSum || 0,
      totalFakturaSum: totalFakturaSum || 0,
      byStatus: byStatus.reduce((acc: any, item: any) => {
        acc[item.automationStatus || 'null'] = parseInt(item.count);
        return acc;
      }, {}),
    };
  }

  /**
   * Sana oralig'idagi record'larni olish
   */
  async getByDateRange(startDate: Date, endDate: Date) {
    const selectChecks = await SelectCheck.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      },
      order: [['createdAt', 'DESC']],
    });

    return selectChecks;
  }

  /**
   * Barcha record'larni o'chirish (ehtiyot bo'ling!)
   */
  async deleteAll() {
    const deletedCount = await SelectCheck.destroy({
      where: {},
      truncate: true,
    });

    return {
      deletedCount,
      message: `Barcha select_check'lar o'chirildi`,
    };
  }

  async markAsReadyForProcessing(id: number) {
    const selectCheck = await this.getById(id);

    // Validatsiya - barcha majburiy maydonlar to'ldirilganmi?
    if (!selectCheck.chekRaqam || !selectCheck.mxik || !selectCheck.ulchov) {
      throw new Error("Barcha maydonlar to'ldirilishi kerak");
    }

    selectCheck.isActive = true;
    selectCheck.automationStatus = 'pending';
    await selectCheck.save();

    return selectCheck;
  }
}
