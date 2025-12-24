import { Op, WhereOptions } from 'sequelize';
import Decimal from 'decimal.js';
import SelectCheck, {
  SelectCheckAttributes,
  SelectCheckCreationAttributes,
} from './selectChecks.model';

// =============================================
// INTERFACES
// =============================================

interface CheckRecord {
  chek_raqam: string;
  chek_summa: number;
  maxsulot_nomi?: string;
  creation_date_check: Date;
}

interface FakturaRecord {
  id: number;
  postTerminalSeria: string;  // Post terminal seriyasi
  mxik: string;
  ulchov: string;
  faktura_summa: number;
  faktura_miqdor: number;
  is_active: boolean;
  creation_data_faktura: Date;  // DATA, not DATE
}

interface CombinationResult {
  checks: CheckRecord[];
  totalSumma: Decimal;
}

interface ProcessResult {
  faktura_id: number;
  mxik: string;
  ulchov: string;
  faktura_summa: number;
  faktura_miqdor: number;
  chek_raqam: string;
  maxsulot_nomi?: string;
  chek_summa: number;
  miqdor: number;
  umumiy_chek_summa: number;
  bir_birlik: number;
  is_active: boolean;
}

/**
 * SelectChecksService - Ma'lumotlar bazasi bilan ishlash
 */
export class SelectChecksService {
  // TOLERANS: 1% (Python da 4% edi, endi 1%)
  private readonly TOLERANCE_PERCENT = 0.01;

  // =============================================
  // FAKTURA-CHECK MOSLASHTIRISH (YANGI)
  // =============================================

  /**
   * Aktiv fakturalarni SANA BO'YICHA tartiblangan holda olish
   * Raw SQL query - Sequelize model bo'lmasa
   */
  async getActiveFakturasRaw(sequelize: any): Promise<FakturaRecord[]> {
    const [results] = await sequelize.query(`
      SELECT id, post_terminal_seria as "postTerminalSeria", mxik, ulchov, faktura_summa, faktura_miqdor, is_active, creation_data_faktura
      FROM faktura
      WHERE is_active = true
      ORDER BY creation_data_faktura ASC, faktura_summa DESC
    `);

    return results as FakturaRecord[];
  }

  /**
   * Processed=false cheklarni olish
   * Faqat faktura sanasidan KEYIN yaratilgan cheklar
   */
  async getUnprocessedChecksAfterDateRaw(
    sequelize: any,
    fakturaSana: Date,
    limitSumma?: number
  ): Promise<CheckRecord[]> {
    let query = `
      SELECT chek_raqam, chek_summa, maxsulot_nomi, creation_date_check
      FROM checks
      WHERE processed = false
        AND creation_date_check >= :fakturaSana
    `;

    const replacements: any = { fakturaSana };

    if (limitSumma !== undefined) {
      query += ` AND chek_summa <= :limitSumma`;
      replacements.limitSumma = limitSumma;
    }

    query += ` ORDER BY creation_date_check ASC, chek_summa DESC`;

    const [results] = await sequelize.query(query, { replacements });
    return results as CheckRecord[];
  }

  /**
   * Eng optimal cheklar kombinatsiyasini topish
   * 
   * QOIDALAR:
   * - Cheklar summasi faktura summasidan KAM bo'lishi MUMKIN EMAS
   * - Teng bo'lishi kerak YOKI 1% gacha ortiq bo'lishi mumkin
   */
  findBestChecksCombination(
    targetSumma: number,
    maxSumma: number,
    availableChecks: CheckRecord[]
  ): CombinationResult {
    const target = new Decimal(targetSumma);
    const max = new Decimal(maxSumma);

    // 1-strategiya: Bitta chek to'liq mos kelishi
    for (const check of availableChecks) {
      const checkSumma = new Decimal(check.chek_summa);
      if (checkSumma.gte(target) && checkSumma.lte(max)) {
        return { checks: [check], totalSumma: checkSumma };
      }
    }

    // 2-strategiya: Bir necha chekni yig'ib olish (greedy)
    const selectedChecks: CheckRecord[] = [];
    let totalSumma = new Decimal(0);

    for (const check of availableChecks) {
      const checkSumma = new Decimal(check.chek_summa);

      if (totalSumma.plus(checkSumma).lte(max)) {
        selectedChecks.push(check);
        totalSumma = totalSumma.plus(checkSumma);

        if (totalSumma.gte(target)) {
          return { checks: selectedChecks, totalSumma };
        }
      }
    }

    // Faqat target dan teng yoki ko'p bo'lsa qaytaramiz
    if (totalSumma.gte(target)) {
      return { checks: selectedChecks, totalSumma };
    }

    return { checks: [], totalSumma: new Decimal(0) };
  }

  /**
   * Bitta fakturani qayta ishlash va select_checks ga yozish
   */
  async processFakturaItem(
    sequelize: any,
    fakturaItem: FakturaRecord
  ): Promise<SelectCheck[]> {
    const transaction = await sequelize.transaction();

    try {
      const fakturaId = fakturaItem.id;
      const mxik = fakturaItem.mxik;
      const ulchov = fakturaItem.ulchov;
      const fakturaSumma = new Decimal(fakturaItem.faktura_summa);
      const fakturaMiqdor = new Decimal(fakturaItem.faktura_miqdor);
      const fakturaSana = fakturaItem.creation_data_faktura;  // DATA, not DATE

      // 1% tolerans
      const maxSumma = fakturaSumma.times(1 + this.TOLERANCE_PERCENT);

      console.log(`   📋 Faktura: MXIK=${mxik}, Ulchov=${ulchov}`);
      console.log(`      📅 Sana: ${fakturaSana}`);
      console.log(`      💰 Target: ${fakturaSumma.toFixed(2)}, Max: ${maxSumma.toFixed(2)} (+${this.TOLERANCE_PERCENT * 100}%)`);

      // Faqat faktura sanasidan KEYIN yaratilgan cheklar
      const allChecks = await this.getUnprocessedChecksAfterDateRaw(
        sequelize,
        fakturaSana,
        maxSumma.toNumber()
      );

      if (allChecks.length === 0) {
        console.log(`      ⚠️ Mos cheklar topilmadi (sana >= ${fakturaSana})`);
        await transaction.rollback();
        return [];
      }

      console.log(`      📦 ${allChecks.length} ta mos chek topildi`);

      const { checks: selectedChecks, totalSumma } = this.findBestChecksCombination(
        fakturaSumma.toNumber(),
        maxSumma.toNumber(),
        allChecks
      );

      if (selectedChecks.length === 0) {
        console.log(`      ⚠️ Optimal kombinatsiya topilmadi`);
        await transaction.rollback();
        return [];
      }

      if (totalSumma.lt(fakturaSumma)) {
        console.log(`      ❌ Cheklar summasi kam!`);
        await transaction.rollback();
        return [];
      }

      // Foiz farqini tekshirish
      if (totalSumma.gt(fakturaSumma)) {
        const percentDiff = totalSumma.minus(fakturaSumma).div(fakturaSumma).times(100);
        if (percentDiff.gt(this.TOLERANCE_PERCENT * 100)) {
          console.log(`      ❌ Cheklar summasi ${percentDiff.toFixed(2)}% ortiq`);
          await transaction.rollback();
          return [];
        }
        console.log(`      ✅ ${selectedChecks.length} ta chek, summa: ${totalSumma.toFixed(2)} (+${percentDiff.toFixed(2)}%)`);
      } else {
        console.log(`      ✅ ${selectedChecks.length} ta chek, summa: ${totalSumma.toFixed(2)}`);
      }

      // Bir birlik narxini hisoblash
      const birBirlik = totalSumma.div(fakturaMiqdor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      // Har bir chek uchun miqdor hisoblash
      const checkMiqdorlar: { check: CheckRecord; checkSumma: Decimal; miqdor: Decimal }[] = [];
      let totalMiqdorUsed = new Decimal(0);

      for (const check of selectedChecks) {
        const checkSumma = new Decimal(check.chek_summa);
        const ulush = checkSumma.div(totalSumma);
        let miqdor = fakturaMiqdor.times(ulush);
        miqdor = miqdor.times(1000000).floor().div(1000000);

        checkMiqdorlar.push({ check, checkSumma, miqdor });
        totalMiqdorUsed = totalMiqdorUsed.plus(miqdor);
      }

      // Farqni eng katta chekka qo'shish
      const difference = fakturaMiqdor.minus(totalMiqdorUsed);
      if (difference.gt(0) && checkMiqdorlar.length > 0) {
        let maxIndex = 0;
        let maxSummaVal = new Decimal(0);
        checkMiqdorlar.forEach((item, idx) => {
          if (item.checkSumma.gt(maxSummaVal)) {
            maxSummaVal = item.checkSumma;
            maxIndex = idx;
          }
        });
        checkMiqdorlar[maxIndex].miqdor = checkMiqdorlar[maxIndex].miqdor.plus(difference);
      }

      // Natijalarni saqlash
      const results: SelectCheck[] = [];

      for (const item of checkMiqdorlar) {
        const { check, checkSumma, miqdor } = item;

        // SelectCheck yaratish (Sequelize model orqali)
        const selectCheck = await SelectCheck.create({
          creationDataFaktura: fakturaSana.toString(),
          postTerminalSeria: fakturaItem.postTerminalSeria, // 🆕 Post terminal seriyasi (fakturadan)
          mxik,
          ulchov,
          fakturaSumma: fakturaSumma.toNumber(),
          fakturaMiqdor: fakturaMiqdor.toNumber(),
          chekRaqam: check.chek_raqam,
          maxsulotNomi: check.maxsulot_nomi || '',
          chekSumma: checkSumma.toNumber(),
          miqdor: miqdor.toNumber(),
          umumiyChekSumma: totalSumma.toNumber(),
          birBirlik: birBirlik.toNumber(),
          isActive: false,
          processed: false,
          automationStatus: 'pending',
        }, { transaction });

        results.push(selectCheck);

        // Chekni processed=true qilish
        await sequelize.query(
          'UPDATE checks SET processed = true WHERE chek_raqam = :chekRaqam',
          { 
            replacements: { chekRaqam: check.chek_raqam },
            transaction 
          }
        );

        console.log(`         • Chek ${check.chek_raqam}: ${checkSumma.toFixed(2)} sum, ${miqdor.toFixed(6)} miqdor`);
      }

      // Fakturani is_active=false qilish
      await sequelize.query(
        'UPDATE faktura SET is_active = false WHERE id = :fakturaId',
        { 
          replacements: { fakturaId },
          transaction 
        }
      );

      await transaction.commit();
      return results;

    } catch (error) {
      await transaction.rollback();
      console.error(`❌ processFakturaItem xatosi:`, error);
      throw error;
    }
  }

  /**
   * Barcha aktiv fakturalarni qayta ishlash
   * SANA BO'YICHA tartiblangan (eski fakturalardan boshlab)
   */
  async processAllFakturas(sequelize: any): Promise<{
    results: SelectCheck[];
    processed: number;
    failed: number;
  }> {
    console.log('\n' + '='.repeat(70));
    console.log('🔄 FAKTURA QAYTA ISHLASH (SANA BO\'YICHA)');
    console.log(`📊 Tolerans: ${this.TOLERANCE_PERCENT * 100}%`);
    console.log('='.repeat(70) + '\n');

    const allResults: SelectCheck[] = [];
    const maxAttempts = 3;
    const failedFakturas: Map<number, number> = new Map();
    let totalProcessed = 0;
    let totalFailed = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`\n🔁 Urinish #${attempt}/${maxAttempts}`);
      console.log('-'.repeat(70));

      const fakturaItems = await this.getActiveFakturasRaw(sequelize);

      if (fakturaItems.length === 0) {
        console.log(`✅ Aktiv faktura topilmadi`);
        break;
      }

      console.log(`📋 ${fakturaItems.length} ta aktiv faktura (sana bo'yicha tartiblangan)\n`);

      let processedCount = 0;

      for (let idx = 0; idx < fakturaItems.length; idx++) {
        const item = fakturaItems[idx];
        const sanaStr = new Date(item.creation_data_faktura).toLocaleDateString('uz-UZ');

        console.log(`${idx + 1}. 📅 ${sanaStr} | MXIK: ${item.mxik} | Summa: ${item.faktura_summa.toLocaleString()}`);

        try {
          const results = await this.processFakturaItem(sequelize, item);

          if (results.length > 0) {
            allResults.push(...results);
            processedCount += results.length;
            totalProcessed += results.length;
            console.log(`   ✅ ${results.length} ta chek qayta ishlandi`);
            failedFakturas.delete(item.id);
          } else {
            console.log(`   ⚠️ Mos chek topilmadi`);
            failedFakturas.set(item.id, (failedFakturas.get(item.id) || 0) + 1);
            totalFailed++;
          }
        } catch (error) {
          console.log(`   ❌ Xatolik:`, error);
          failedFakturas.set(item.id, (failedFakturas.get(item.id) || 0) + 1);
          totalFailed++;
        }
        console.log();
      }

      console.log(`📊 ${attempt}-urinish: ${processedCount} ta chek qayta ishlandi`);

      if (processedCount === 0 && attempt < maxAttempts) {
        console.log('⚠️ Hech narsa qayta ishlanmadi, keyingi urinish...');
      }
    }

    // Qayta ishlanmagan fakturalarni is_active=false qilish
    for (const [fakturaId, attempts] of failedFakturas) {
      if (attempts >= maxAttempts) {
        await sequelize.query(
          'UPDATE faktura SET is_active = false WHERE id = :fakturaId',
          { replacements: { fakturaId } }
        );
        console.log(`⛔ Faktura #${fakturaId} → is_active=false (${maxAttempts} urinishdan keyin)`);
      }
    }

    // Yakuniy hisobot
    console.log('\n' + '='.repeat(70));
    console.log('📈 YAKUNIY NATIJA');
    console.log('='.repeat(70));
    console.log(`✅ Jami yaratilgan select_checks: ${allResults.length}`);
    console.log(`✅ Muvaffaqiyatli: ${totalProcessed}`);
    console.log(`❌ Muvaffaqiyatsiz: ${totalFailed}`);
    console.log('='.repeat(70) + '\n');

    return {
      results: allResults,
      processed: totalProcessed,
      failed: totalFailed,
    };
  }

  /**
   * Reset - select_checks tozalash, checks va faktura qayta tiklash
   */
  async resetAll(sequelize: any): Promise<{
    selectChecksDeleted: number;
    checksReset: number;
    fakturasReset: number;
  }> {
    console.log('\n⚠️ RESET JARAYONI...');

    // select_checks tozalash
    const selectChecksDeleted = await SelectCheck.destroy({ where: {}, truncate: true });
    console.log(`   🗑️ select_checks tozalandi`);

    // Barcha cheklar processed=false
    const [, checksResult] = await sequelize.query('UPDATE checks SET processed = false');
    console.log(`   ♻️ Barcha cheklar processed=false`);

    // Barcha fakturalar is_active=true
    const [, fakturasResult] = await sequelize.query('UPDATE faktura SET is_active = true');
    console.log(`   ♻️ Barcha fakturalar is_active=true`);

    console.log('✅ Reset yakunlandi\n');

    return {
      selectChecksDeleted: selectChecksDeleted || 0,
      checksReset: 0,
      fakturasReset: 0,
    };
  }

  // =============================================
  // MAVJUD METODLAR (O'zgarishsiz)
  // =============================================

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

    if (search) {
      where[Op.or] = [
        { maxsulotNomi: { [Op.iLike]: `%${search}%` } },
        { chekRaqam: { [Op.iLike]: `%${search}%` } },
        { mxik: { [Op.iLike]: `%${search}%` } },
      ];
    }

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

    if (!selectCheck.chekRaqam || !selectCheck.mxik || !selectCheck.ulchov) {
      throw new Error("Barcha maydonlar to'ldirilishi kerak");
    }

    selectCheck.isActive = true;
    selectCheck.automationStatus = 'pending';
    await selectCheck.save();

    return selectCheck;
  }
}