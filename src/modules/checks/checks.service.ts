import Check from './checks.model';
import { Op, Transaction } from 'sequelize';
import * as XLSX from 'xlsx';
import sequelize from '../../config/database';

interface ExcelCheckRow {
  creation_date_check?: string;
  chek_raqam?: string;
  chek_summa?: number | string;
  maxsulot_nomi?: string;
  [key: string]: any;
}

interface ImportResult {
  total: number;
  imported: number;
  failed: number;
  skipped: number;
  errors: Array<{
    row: number;
    message: string;
    data?: any;
  }>;
}

/**
 * Helper: Stringni Date obyektiga aylantirish
 */
function parseDate(dateInput: any): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  
  const dateStr = String(dateInput).trim();
  
  if (dateStr === 'Invalid Date' || dateStr === '') {
    return new Date();
  }
  
  // Format: "26.01.2024 10:05:44" yoki "26.01.2024"
  if (dateStr.includes('.')) {
    const datePart = dateStr.split(' ')[0];
    const parts = datePart.split('.');
    
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
  }
  
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  return new Date();
}

/**
 * Helper: Date obyektini string formatga aylantirish (DD.MM.YYYY)
 */
function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

class ChecksService {
  async importFromExcel(
    filePath: string,
    userId: number,
    importId?: number
  ): Promise<ImportResult> {
    const errors: Array<{ row: number; message: string; data?: any }> = [];
    let imported = 0;
    let failed = 0;
    let skipped = 0;

    const transaction = await sequelize.transaction();

    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const jsonData: ExcelCheckRow[] = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: null,
        blankrows: false,
      });

      // console.log(`📊 Excel'dan ${jsonData.length} ta qator o'qildi`);

      if (jsonData.length === 0) {
        await transaction.rollback();
        return {
          total: 0,
          imported: 0,
          failed: 0,
          skipped: 0,
          errors: [{ row: 0, message: 'Excel faylda ma\'lumot topilmadi' }],
        };
      }

      const allChekRaqams = jsonData
        .map(row => row.chek_raqam)
        .filter(Boolean) as string[];

      const existingChecks = await Check.findAll({
        where: {
          chekRaqam: {
            [Op.in]: allChekRaqams,
          },
        },
        attributes: ['chekRaqam'],
        transaction,
      });

      const existingChekRaqamsSet = new Set(
        existingChecks.map(check => check.chekRaqam)
      );

      const validChecks: Array<{
        creation_date_check: string;
        chekRaqam: string;
        chekSumma: number;
        maxsulotNomi: string;
        processed: boolean;
        createdBy: number;
        source: 'excel';
        importId?: number;
      }> = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNumber = i + 2;

        try {
          if (!row.creation_date_check && !row.chek_raqam && !row.chek_summa && !row.maxsulot_nomi) {
            skipped++;
            continue;
          }

          const validationErrors: string[] = [];

          if (!row.creation_date_check || String(row.creation_date_check).trim() === '') {
            validationErrors.push('creation_date_check');
          }

          if (!row.chek_raqam || String(row.chek_raqam).trim() === '') {
            validationErrors.push('chek_raqam');
          }

          if (!row.chek_summa || row.chek_summa === null) {
            validationErrors.push('chek_summa');
          }

          if (!row.maxsulot_nomi || String(row.maxsulot_nomi).trim() === '') {
            validationErrors.push('maxsulot_nomi');
          }

          if (validationErrors.length > 0) {
            errors.push({
              row: rowNumber,
              message: `Majburiy maydonlar to'ldirilmagan: ${validationErrors.join(', ')}`,
              data: row,
            });
            failed++;
            continue;
          }

          const chekSumma = parseFloat(String(row.chek_summa).replace(/,/g, ''));
          
          if (isNaN(chekSumma) || chekSumma < 0) {
            errors.push({
              row: rowNumber,
              message: `Noto'g'ri chek summa: ${row.chek_summa}`,
              data: row,
            });
            failed++;
            continue;
          }

          const chekRaqam = String(row.chek_raqam).trim();

          if (existingChekRaqamsSet.has(chekRaqam)) {
            errors.push({
              row: rowNumber,
              message: `Chek raqam "${chekRaqam}" allaqachon mavjud`,
              data: row,
            });
            skipped++;
            continue;
          }

          const duplicateInBatch = validChecks.find(
            check => check.chekRaqam === chekRaqam
          );

          if (duplicateInBatch) {
            errors.push({
              row: rowNumber,
              message: `Chek raqam "${chekRaqam}" Excel faylda takrorlangan`,
              data: row,
            });
            skipped++;
            continue;
          }

          validChecks.push({
            creation_date_check: String(row.creation_date_check).trim(),
            chekRaqam: chekRaqam,
            chekSumma: chekSumma,
            maxsulotNomi: String(row.maxsulot_nomi).trim(),
            processed: false,
            createdBy: userId,
            source: 'excel',
            importId,
          });

          imported++;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Noma\'lum xato';
          errors.push({
            row: rowNumber,
            message,
            data: row,
          });
          failed++;
        }
      }

      if (validChecks.length > 0) {
        await Check.bulkCreate(validChecks, {
          transaction,
          validate: true,
        });

        console.log(`✅ ${validChecks.length} ta check muvaffaqiyatli import qilindi`);
      }

      await transaction.commit();

      return {
        total: jsonData.length,
        imported,
        failed,
        skipped,
        errors,
      };
    } catch (error) {
      await transaction.rollback();
      console.error('Excel import error:', error);
      
      throw new Error(
        error instanceof Error 
          ? `Excel import xatosi: ${error.message}` 
          : 'Excel faylni o\'qishda xato'
      );
    }
  }

  async getAllChecks(params: {
    page: number;
    limit: number;
    search?: string;
    processed?: boolean;
    userId?: number;
    importId?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const { page, limit, search, processed, userId, importId, startDate, endDate } = params;
    const offset = (page - 1) * limit;

    const whereClause: any = {};

    if (search) {
      whereClause[Op.or] = [
        { chekRaqam: { [Op.iLike]: `%${search}%` } },
        { maxsulotNomi: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (typeof processed === 'boolean') {
      whereClause.processed = processed;
    }

    if (userId) {
      whereClause.createdBy = userId;
    }

    if (importId) {
      whereClause.importId = importId;
    }

    if (startDate && endDate) {
      whereClause.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    } else if (startDate) {
      whereClause.createdAt = {
        [Op.gte]: new Date(startDate),
      };
    } else if (endDate) {
      whereClause.createdAt = {
        [Op.lte]: new Date(endDate),
      };
    }

    const { count, rows } = await Check.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      checks: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getCheckById(id: number) {
    const check = await Check.findByPk(id);
    
    if (!check) {
      throw new Error('Check topilmadi');
    }

    return check;
  }

  async createCheck(data: {
    creation_date_check: string;
    chekRaqam: string;
    chekSumma: number;
    maxsulotNomi: string;
    userId: number;
  }) {
    const existingCheck = await Check.findOne({
      where: { chekRaqam: data.chekRaqam.trim() },
    });

    if (existingCheck) {
      throw new Error('Bu chek raqam allaqachon mavjud');
    }

    if (data.chekSumma < 0) {
      throw new Error('Chek summa manfiy bo\'lishi mumkin emas');
    }

    const check = await Check.create({
      creation_date_check: data.creation_date_check.trim(),
      chekRaqam: data.chekRaqam.trim(),
      chekSumma: data.chekSumma,
      maxsulotNomi: data.maxsulotNomi.trim(),
      processed: false,
      createdBy: data.userId,
      source: 'manual',
    });

    return check;
  }

  async updateCheck(
    id: number,
    data: {
      creation_date_check?: string;
      chekRaqam?: string;
      chekSumma?: number;
      maxsulotNomi?: string;
      processed?: boolean;
    }
  ) {
    const check = await Check.findByPk(id);

    if (!check) {
      throw new Error('Check topilmadi');
    }

    if (data.chekRaqam && data.chekRaqam !== check.chekRaqam) {
      const existingCheck = await Check.findOne({
        where: {
          chekRaqam: data.chekRaqam.trim(),
          id: { [Op.ne]: id },
        },
      });

      if (existingCheck) {
        throw new Error('Bu chek raqam boshqa checkda mavjud');
      }
    }

    if (data.chekSumma !== undefined && data.chekSumma < 0) {
      throw new Error('Chek summa manfiy bo\'lishi mumkin emas');
    }

    const updateData: any = {};
    if (data.creation_date_check) updateData.creation_date_check = data.creation_date_check.trim();
    if (data.chekRaqam) updateData.chekRaqam = data.chekRaqam.trim();
    if (data.chekSumma !== undefined) updateData.chekSumma = data.chekSumma;
    if (data.maxsulotNomi) updateData.maxsulotNomi = data.maxsulotNomi.trim();
    if (data.processed !== undefined) updateData.processed = data.processed;

    await check.update(updateData);
    return check;
  }

  async deleteCheck(id: number) {
    const check = await Check.findByPk(id);

    if (!check) {
      throw new Error('Check topilmadi');
    }

    if (check.processed) {
      throw new Error('Qayta ishlangan checkni o\'chirish mumkin emas. Avval processed=false qiling.');
    }

    await check.destroy();
    return { message: 'Check o\'chirildi' };
  }

  async bulkDeleteChecks(ids: number[], userId: number) {
    const checks = await Check.findAll({
      where: {
        id: { [Op.in]: ids },
        createdBy: userId,
        processed: false,
      },
    });

    if (checks.length === 0) {
      throw new Error('O\'chirish uchun checklar topilmadi');
    }

    await Check.destroy({
      where: {
        id: { [Op.in]: checks.map(c => c.id) },
      },
    });

    return {
      message: `${checks.length} ta check o'chirildi`,
      deleted: checks.length,
    };
  }

  async markAsProcessed(checkIds: number[]) {
    await Check.update(
      { processed: true },
      {
        where: {
          id: { [Op.in]: checkIds },
          processed: false,
        },
      }
    );

    return { message: `${checkIds.length} ta check processed qilindi` };
  }

  async markAsUnprocessed(checkIds: number[]) {
    await Check.update(
      { processed: false },
      {
        where: {
          id: { [Op.in]: checkIds },
          processed: true,
        },
      }
    );

    return { message: `${checkIds.length} ta check unprocessed qilindi` };
  }

  async getStatistics(userId?: number) {
    const whereClause: any = {};
    
    if (userId) {
      whereClause.createdBy = userId;
    }

    const [
      total,
      processed,
      unprocessed,
      totalSumma,
      processedSumma,
    ] = await Promise.all([
      Check.count({ where: whereClause }),
      Check.count({ where: { ...whereClause, processed: true } }),
      Check.count({ where: { ...whereClause, processed: false } }),
      Check.sum('chekSumma', { where: whereClause }),
      Check.sum('chekSumma', { where: { ...whereClause, processed: true } }),
    ]);

    return {
      total,
      processed,
      unprocessed,
      totalSumma: totalSumma || 0,
      processedSumma: processedSumma || 0,
      unprocessedSumma: (totalSumma || 0) - (processedSumma || 0),
    };
  }

  async findByChekRaqam(chekRaqam: string) {
    return await Check.findOne({
      where: { chekRaqam: chekRaqam.trim() },
    });
  }
}

export default new ChecksService();