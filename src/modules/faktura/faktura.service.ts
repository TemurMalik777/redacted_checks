// src/modules/faktura/faktura.service.ts

import Faktura from './faktura.model';
import Check from '../checks/checks.model';
import xlsx from 'xlsx';
import fs from 'fs';
import sequelize from '../../config/database';
import { Op } from 'sequelize';

interface ImportResult {
  total: number;
  imported: number;
  failed: number;
  skipped: number;
  errors: Array<{
    row: number;
    message: string;
    data: any;
  }>;
}

interface GetAllFakturasParams {
  page: number;
  limit: number;
  isActive?: boolean;
  mxik?: string;
}

class FakturaService {
  /**
   * Barcha fakturalarni olish
   */
  async getAllFakturas(params: GetAllFakturasParams) {
    const { page, limit, isActive, mxik } = params;
    const offset = (page - 1) * limit;

    const where: any = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (mxik) {
      where.mxik = { [Op.like]: `%${mxik}%` };
    }

    const { count, rows } = await Faktura.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Check,
          as: 'relatedCheck',
          required: false,
          attributes: ['id', 'chekRaqam', 'chekSumma', 'maxsulotNomi'],
        },
      ],
    });

    return {
      fakturas: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Statistika olish
   */
  async getStats() {
    const total = await Faktura.count();
    const active = await Faktura.count({ where: { isActive: true } });
    const inactive = await Faktura.count({ where: { isActive: false } });

    // Bog'langan fakturalar soni
    const linked = await Faktura.count({
      where: {
        relatedCheckId: { [Op.ne]: undefined },
      },
    });

    // Bog'lanmagan fakturalar soni
    const unlinked = await Faktura.count({
      where: {
        relatedCheckId: null as any,
      },
    });

    const totalSumResult = await Faktura.sum('fakturaSumma');
    const totalSum = totalSumResult || 0;

    const activeSumResult = await Faktura.sum('fakturaSumma', {
      where: { isActive: true },
    });
    const activeSum = activeSumResult || 0;

    return {
      total,
      active,
      inactive,
      linked,
      unlinked,
      totalSum,
      activeSum,
    };
  }

  /**
   * Bitta fakturani olish
   */
  async getFakturaById(id: number) {
    return await Faktura.findByPk(id, {
      include: [
        {
          model: Check,
          as: 'relatedCheck',
          required: false,
        },
      ],
    });
  }

  /**
   * Excel dan import qilish
   */
  async importFromExcel(
    filePath: string,
    importId?: number,
  ): Promise<ImportResult> {
    const transaction = await sequelize.transaction();

    try {
      const workbook = xlsx.readFile(filePath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = xlsx.utils.sheet_to_json(worksheet);

      // 🔍 DEBUG
      console.log('Excel ustunlari:', Object.keys(rows[0] || {}));

      const results: ImportResult = {
        total: rows.length,
        imported: 0,
        failed: 0,
        skipped: 0,
        errors: [],
      };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2;

        // ✅ TO'G'RILANGAN: Excel ustun nomlariga mos
        const postTerminal =
          row['post_terminal_serai'] || row['post_terminal_seria'];
        const creationDate =
          row['creation_date_faktura'] || row['creation_data_faktura'];
        const mxik = row['mxik'];
        const ulchov = row['ulchov'];
        const fakturaSumma = row['faktura_summa'];
        const fakturaMiqdor = row['faktura_miqdor'];

        const hasFakturaData =
          postTerminal &&
          creationDate &&
          mxik &&
          ulchov &&
          fakturaSumma !== undefined &&
          fakturaMiqdor !== undefined;

        if (!hasFakturaData) {
          results.skipped++;
          results.errors.push({
            row: rowNumber,
            message: "Majburiy maydonlar to'ldirilmagan",
            data: row,
          });
          continue;
        }

        const savepoint = `sp_row_${i}`;
        await sequelize.query(`SAVEPOINT ${savepoint}`, { transaction });

        try {
          await Faktura.create(
            {
              postTerminalSeria: String(postTerminal),
              creation_data_faktura: String(creationDate),
              mxik: String(mxik),
              ulchov: String(ulchov),
              fakturaSumma: parseFloat(fakturaSumma) || 0,
              fakturaMiqdor: parseFloat(fakturaMiqdor) || 0,
              isActive: true,
              ...(importId && { importId }),
            },
            { transaction },
          );

          await sequelize.query(`RELEASE SAVEPOINT ${savepoint}`, {
            transaction,
          });
          results.imported++;
        } catch (error: any) {
          await sequelize.query(`ROLLBACK TO SAVEPOINT ${savepoint}`, {
            transaction,
          });

          results.failed++;
          results.errors.push({
            row: rowNumber,
            message: error.message || "Noma'lum xatolik",
            data: row,
          });
          console.error(`Qator ${rowNumber} xatosi:`, error.message);
        }
      }

      await transaction.commit();
      this.cleanupFile(filePath);
      return results;
    } catch (error) {
      await transaction.rollback();
      this.cleanupFile(filePath);
      throw error;
    }
  }

  /**
   * Fakturani tahrirlash
   */
  async updateFaktura(id: number, data: Partial<Faktura>) {
    const faktura = await Faktura.findByPk(id);

    if (!faktura) {
      return null;
    }

    await faktura.update(data);
    return faktura;
  }

  /**
   * Fakturani o'chirish (soft delete)
   */
  async deleteFaktura(id: number) {
    const faktura = await Faktura.findByPk(id);

    if (!faktura) {
      return false;
    }

    await faktura.update({ isActive: false });
    return true;
  }

  /**
   * Ko'plab fakturalarni o'chirish
   */
  async bulkDeleteFakturas(ids: number[]) {
    const result = await Faktura.update(
      { isActive: false },
      { where: { id: { [Op.in]: ids } } },
    );

    return result[0]; // Updated count
  }

  /**
   * Faktura va Check matching
   * Bu funksiya keyinchalik matching logikasi uchun
   */
  async matchFakturaWithCheck(fakturaId: number, checkId: number) {
    const faktura = await Faktura.findByPk(fakturaId);
    const check = await Check.findByPk(checkId);

    if (!faktura || !check) {
      throw new Error('Faktura yoki Check topilmadi');
    }

    // Fakturani check bilan bog'lash
    await faktura.update({
      relatedCheckId: checkId,
    });

    return faktura;
  }

  /**
   * Bog'lanmagan fakturalarni olish
   */
  /**
   * Bog'lanmagan fakturalarni olish
   */
  async getUnlinkedFakturas(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const { count, rows } = await Faktura.findAndCountAll({
      where: {
        relatedCheckId: null as any,
        isActive: true,
      },
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      fakturas: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Faylni o'chirish (private helper)
   */
  private cleanupFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error("Fayl o'chirishda xatolik:", e);
      }
    }
  }
}


export default new FakturaService();
