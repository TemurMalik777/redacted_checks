import { Op } from 'sequelize';
import Decimal from 'decimal.js';
import logger from '@/utils/logger';
import SelectCheck, {
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
  post_terminal_seria: string;
  mxik: string;
  ulchov: string;
  faktura_summa: number;
  faktura_miqdor: number;
  is_active: boolean;
  creation_data_faktura: Date;
}

interface CombinationResult {
  checks: CheckRecord[];
  totalSumma: Decimal;
}

/**
 * SelectChecksService - Faktura va Check'larni moslashtirish
 */
export class SelectChecksService {
  // TOLERANS: 1% oshishga ruxsat
  private readonly TOLERANCE_PERCENT = 0.01;

  // =============================================
  // FAKTURA-CHECK MOSLASHTIRISH
  // =============================================

  /**
   * Aktiv fakturalarni SANA BO'YICHA tartiblangan holda olish
   */
  async getActiveFakturasRaw(sequelize: any): Promise<FakturaRecord[]> {
    const [results] = await sequelize.query(`
      SELECT 
        id, 
        post_terminal_seria, 
        mxik, 
        ulchov, 
        faktura_summa, 
        faktura_miqdor, 
        is_active, 
        creation_data_faktura
      FROM faktura
      WHERE is_active = true
      ORDER BY creation_data_faktura ASC, faktura_summa DESC
    `);

    return results as FakturaRecord[];
  }

  /**
   * Processed=false va faktura sanasidan KEYIN yaratilgan cheklarni olish
   */
  async getUnprocessedChecksAfterDateRaw(
    sequelize: any,
    fakturaSana: Date,
    limitSumma?: number,
  ): Promise<CheckRecord[]> {
    let query = `
      SELECT 
        chek_raqam, 
        chek_summa, 
        maxsulot_nomi, 
        creation_date_check
      FROM checks
      WHERE processed = false
        AND creation_date_check > :fakturaSana
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
   * - Cheklar summasi faktura summasidan KAM bo'lmasligi kerak
   * - Teng yoki 1% gacha ortiq bo'lishi mumkin
   */
  findBestChecksCombination(
    targetSumma: number,
    maxSumma: number,
    availableChecks: CheckRecord[],
  ): CombinationResult {
    const target = new Decimal(targetSumma);
    const max = new Decimal(maxSumma);

    // 1-strategiya: Bitta chek to'liq mos kelishi
    for (const check of availableChecks) {
      const checkSumma = new Decimal(check.chek_summa);
      if (checkSumma.gte(target) && checkSumma.lte(max)) {
        logger.debug('Bitta chek topildi', {
          chek_raqam: check.chek_raqam,
          summa: checkSumma.toNumber(),
        });
        return { checks: [check], totalSumma: checkSumma };
      }
    }

    // 2-strategiya: Bir necha chekni yig'ib olish (greedy algorithm)
    const selectedChecks: CheckRecord[] = [];
    let totalSumma = new Decimal(0);

    for (const check of availableChecks) {
      const checkSumma = new Decimal(check.chek_summa);

      if (totalSumma.plus(checkSumma).lte(max)) {
        selectedChecks.push(check);
        totalSumma = totalSumma.plus(checkSumma);

        // Target ga yetdikmi tekshirish
        if (totalSumma.gte(target)) {
          logger.debug("Ko'p chek kombinatsiyasi topildi", {
            count: selectedChecks.length,
            total: totalSumma.toNumber(),
          });
          return { checks: selectedChecks, totalSumma };
        }
      }
    }

    // Target dan kam bo'lsa, bo'sh qaytaramiz
    if (totalSumma.lt(target)) {
      logger.debug("Yetarli summa to'planmadi", {
        target: target.toNumber(),
        collected: totalSumma.toNumber(),
      });
      return { checks: [], totalSumma: new Decimal(0) };
    }

    return { checks: selectedChecks, totalSumma };
  }

  /**
   * 🔥 TO'G'RI MIQDOR HISOBLASH
   *
   * FORMULA:
   * 1. bir_birlik = total_summa / faktura_miqdor
   * 2. miqdor = check_summa / bir_birlik
   * 3. 6 xonali aniqlikda PASTGA yaxlitlash
   * 4. Qoldiqni eng katta chekka qo'shish
   */
  calculateMiqdorlar(
    checks: CheckRecord[],
    totalSumma: Decimal,
    fakturaMiqdor: Decimal,
  ): { check: CheckRecord; checkSumma: Decimal; miqdor: Decimal }[] {
    // 1. Bir birlik narxini hisoblash
    // bir_birlik = total_summa / faktura_miqdor
    const birBirlik = totalSumma.div(fakturaMiqdor);

    logger.debug('Bir birlik narxi', {
      total_summa: totalSumma.toNumber(),
      faktura_miqdor: fakturaMiqdor.toNumber(),
      bir_birlik: birBirlik.toNumber(),
    });

    // 2. Har bir chek uchun miqdor hisoblash
    const checkMiqdorlar: {
      check: CheckRecord;
      checkSumma: Decimal;
      miqdor: Decimal;
    }[] = [];
    let totalMiqdorUsed = new Decimal(0);

    for (const check of checks) {
      const checkSumma = new Decimal(check.chek_summa);

      // 🔥 TO'G'RI FORMULA: miqdor = check_summa / bir_birlik
      let miqdor = checkSumma.div(birBirlik);

      // 6 xonali aniqlikda, PASTGA yaxlitlash (floor)
      // Masalan: 12.345678 → 12.345678 * 1000000 = 12345678 → floor() = 12345678 → / 1000000 = 12.345678
      // Masalan: 12.3456789 → 12345678.9 → floor() = 12345678 → 12.345678
      miqdor = miqdor.times(1000000).floor().div(1000000);

      checkMiqdorlar.push({ check, checkSumma, miqdor });
      totalMiqdorUsed = totalMiqdorUsed.plus(miqdor);

      logger.debug('Chek miqdori hisoblandi', {
        chek_raqam: check.chek_raqam,
        chek_summa: checkSumma.toNumber(),
        bir_birlik: birBirlik.toNumber(),
        miqdor: miqdor.toNumber(),
      });
    }

    // 3. Farqni eng katta summali chekka qo'shish
    const difference = fakturaMiqdor.minus(totalMiqdorUsed);

    if (difference.gt(0) && checkMiqdorlar.length > 0) {
      // Eng katta summali chekni topish
      let maxIndex = 0;
      let maxSummaVal = new Decimal(0);

      checkMiqdorlar.forEach((item, idx) => {
        if (item.checkSumma.gt(maxSummaVal)) {
          maxSummaVal = item.checkSumma;
          maxIndex = idx;
        }
      });

      // Qoldiqni qo'shish
      const oldMiqdor = checkMiqdorlar[maxIndex].miqdor;
      checkMiqdorlar[maxIndex].miqdor = oldMiqdor.plus(difference);

      logger.debug("Qoldiq eng katta chekka qo'shildi", {
        chek_raqam: checkMiqdorlar[maxIndex].check.chek_raqam,
        old_miqdor: oldMiqdor.toNumber(),
        difference: difference.toNumber(),
        new_miqdor: checkMiqdorlar[maxIndex].miqdor.toNumber(),
      });
    }

    // 4. Jami miqdorni tekshirish
    const finalTotal = checkMiqdorlar.reduce(
      (sum, item) => sum.plus(item.miqdor),
      new Decimal(0),
    );

    logger.debug('Miqdor taqsimoti yakunlandi', {
      faktura_miqdor: fakturaMiqdor.toNumber(),
      total_calculated: finalTotal.toNumber(),
      difference: fakturaMiqdor.minus(finalTotal).toNumber(),
    });

    return checkMiqdorlar;
  }

  /**
   * Bitta fakturani qayta ishlash va select_checks ga yozish
   */
  async processFakturaItem(
    sequelize: any,
    fakturaItem: FakturaRecord,
  ): Promise<SelectCheck[]> {
    const transaction = await sequelize.transaction();

    try {
      const fakturaId = fakturaItem.id;
      const mxik = fakturaItem.mxik;
      const ulchov = fakturaItem.ulchov;
      const fakturaSumma = new Decimal(fakturaItem.faktura_summa);
      const fakturaMiqdor = new Decimal(fakturaItem.faktura_miqdor);

      // ✅ Date obyektiga aylantirish
      const fakturaSanaDate =
        fakturaItem.creation_data_faktura instanceof Date
          ? fakturaItem.creation_data_faktura
          : new Date(fakturaItem.creation_data_faktura);

      // ✅ String formatga o'tkazish (model uchun)
      const fakturaSanaStr = fakturaSanaDate.toLocaleDateString('en-GB'); // DD/MM/YYYY

      const maxSumma = fakturaSumma.times(1 + this.TOLERANCE_PERCENT);

      console.log(`   📋 Faktura: MXIK=${mxik}, Ulchov=${ulchov}`);
      console.log(`      📅 Sana: ${fakturaSanaStr}`);
      console.log(
        `      💰 Target: ${fakturaSumma.toFixed(2)}, Max: ${maxSumma.toFixed(
          2,
        )}`,
      );

      // ✅ Date obyektini SQL query ga o'tkazamiz
      const allChecks = await this.getUnprocessedChecksAfterDateRaw(
        sequelize,
        fakturaSanaDate, // Date obyekti
        maxSumma.toNumber(),
      );

      if (allChecks.length === 0) {
        console.log(
          `      ⚠️ Mos cheklar topilmadi (sana >= ${fakturaSanaStr})`,
        );
        await transaction.rollback();
        return [];
      }

      console.log(`      📦 ${allChecks.length} ta mos chek topildi`);

      const { checks: selectedChecks, totalSumma } =
        this.findBestChecksCombination(
          fakturaSumma.toNumber(),
          maxSumma.toNumber(),
          allChecks,
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
        const percentDiff = totalSumma
          .minus(fakturaSumma)
          .div(fakturaSumma)
          .times(100);
        if (percentDiff.gt(this.TOLERANCE_PERCENT * 100)) {
          console.log(
            `      ❌ Cheklar summasi ${percentDiff.toFixed(2)}% ortiq`,
          );
          await transaction.rollback();
          return [];
        }
        console.log(
          `      ✅ ${
            selectedChecks.length
          } ta chek, summa: ${totalSumma.toFixed(2)} (+${percentDiff.toFixed(
            2,
          )}%)`,
        );
      } else {
        console.log(
          `      ✅ ${
            selectedChecks.length
          } ta chek, summa: ${totalSumma.toFixed(2)}`,
        );
      }

      const birBirlik = totalSumma
        .div(fakturaMiqdor)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      // Miqdorlarni hisoblash
      const checkMiqdorlar: {
        check: CheckRecord;
        checkSumma: Decimal;
        miqdor: Decimal;
      }[] = [];
      let totalMiqdorUsed = new Decimal(0);

      for (const check of selectedChecks) {
        const checkSumma = new Decimal(check.chek_summa);
        const ulush = checkSumma.div(totalSumma);
        let miqdor = fakturaMiqdor.times(ulush);
        miqdor = miqdor.times(1000000).floor().div(1000000);

        checkMiqdorlar.push({ check, checkSumma, miqdor });
        totalMiqdorUsed = totalMiqdorUsed.plus(miqdor);
      }

      // Farqni tuzatish
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
        checkMiqdorlar[maxIndex].miqdor =
          checkMiqdorlar[maxIndex].miqdor.plus(difference);
      }

      // ✅ SelectCheck yaratish
      const results: SelectCheck[] = [];

      for (const item of checkMiqdorlar) {
        const { check, checkSumma, miqdor } = item;

        // ✅ String formatda saqlaymiz
        const selectCheck = await SelectCheck.create(
          {
            creationDataFaktura: fakturaSanaStr, // ✅ String format
            creation_date_check: check.creation_date_check
              ? new Date(check.creation_date_check).toLocaleDateString('en-GB')
              : null, // ✅ String format yoki null
            postTerminalSeria: fakturaItem.post_terminal_seria,
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
          },
          { transaction },
        );

        results.push(selectCheck);

        // Chekni processed qilish
        await sequelize.query(
          'UPDATE checks SET processed = true WHERE chek_raqam = :chekRaqam',
          {
            replacements: { chekRaqam: check.chek_raqam },
            transaction,
          },
        );

        console.log(
          `         • Chek ${check.chek_raqam}: ${checkSumma.toFixed(
            2,
          )} sum, ${miqdor.toFixed(6)} miqdor`,
        );
      }

      // Fakturani deaktiv qilish
      await sequelize.query(
        'UPDATE faktura SET is_active = false WHERE id = :fakturaId',
        {
          replacements: { fakturaId },
          transaction,
        },
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
   */
  async processAllFakturas(sequelize: any): Promise<{
    results: SelectCheck[];
    processed: number;
    failed: number;
  }> {
    logger.info('═══════════════════════════════════════════════');
    logger.info('🔄 FAKTURA QAYTA ISHLASH BOSHLANDI');
    logger.info(`📊 Tolerans: ${this.TOLERANCE_PERCENT * 100}%`);
    logger.info('═══════════════════════════════════════════════');

    const allResults: SelectCheck[] = [];
    const maxAttempts = 3;
    const failedFakturas: Map<number, number> = new Map();
    let totalProcessed = 0;
    let totalFailed = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      logger.info(`🔁 Urinish #${attempt}/${maxAttempts}`);

      const fakturaItems = await this.getActiveFakturasRaw(sequelize);

      if (fakturaItems.length === 0) {
        logger.info('✅ Aktiv faktura topilmadi');
        break;
      }

      logger.info(
        `📋 ${fakturaItems.length} ta aktiv faktura (sana bo'yicha tartiblangan)`,
      );

      let processedCount = 0;

      for (let idx = 0; idx < fakturaItems.length; idx++) {
        const item = fakturaItems[idx];
        const sanaStr = new Date(item.creation_data_faktura).toLocaleDateString(
          'uz-UZ',
        );

        logger.info(
          `${idx + 1}. 📅 ${sanaStr} | MXIK: ${
            item.mxik
          } | Summa: ${item.faktura_summa.toLocaleString()}`,
        );

        try {
          const results = await this.processFakturaItem(sequelize, item);

          if (results.length > 0) {
            allResults.push(...results);
            processedCount += results.length;
            totalProcessed += results.length;
            logger.info(`   ✅ ${results.length} ta chek qayta ishlandi`);
            failedFakturas.delete(item.id);
          } else {
            logger.warn('   ⚠️ Mos chek topilmadi');
            failedFakturas.set(item.id, (failedFakturas.get(item.id) || 0) + 1);
            totalFailed++;
          }
        } catch (error) {
          logger.error('   ❌ Xatolik', {
            error: error instanceof Error ? error.message : String(error),
          });
          failedFakturas.set(item.id, (failedFakturas.get(item.id) || 0) + 1);
          totalFailed++;
        }
      }

      logger.info(
        `📊 ${attempt}-urinish: ${processedCount} ta chek qayta ishlandi`,
      );

      if (processedCount === 0 && attempt < maxAttempts) {
        logger.warn('⚠️ Hech narsa qayta ishlanmadi, keyingi urinish...');
      }
    }

    // Qayta ishlanmagan fakturalarni is_active=false qilish
    for (const [fakturaId, attempts] of failedFakturas) {
      if (attempts >= maxAttempts) {
        await sequelize.query(
          'UPDATE faktura SET is_active = false WHERE id = :fakturaId',
          { replacements: { fakturaId } },
        );
        logger.warn(
          `⛔ Faktura #${fakturaId} → is_active=false (${maxAttempts} urinishdan keyin)`,
        );
      }
    }

    logger.info('═══════════════════════════════════════════════');
    logger.info('📈 YAKUNIY NATIJA');
    logger.info('═══════════════════════════════════════════════');
    logger.info(`✅ Jami yaratilgan select_checks: ${allResults.length}`);
    logger.info(`✅ Muvaffaqiyatli: ${totalProcessed}`);
    logger.info(`❌ Muvaffaqiyatsiz: ${totalFailed}`);
    logger.info('═══════════════════════════════════════════════');

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
    logger.warn('⚠️ RESET JARAYONI BOSHLANDI');

    const selectChecksDeleted = await SelectCheck.destroy({
      where: {},
      truncate: true,
    });
    logger.info('🗑️ select_checks tozalandi');

    await sequelize.query('UPDATE checks SET processed = false');
    logger.info('♻️ Barcha cheklar processed=false');

    await sequelize.query('UPDATE faktura SET is_active = true');
    logger.info('♻️ Barcha fakturalar is_active=true');

    logger.info('✅ Reset yakunlandi');

    return {
      selectChecksDeleted: selectChecksDeleted || 0,
      checksReset: 0,
      fakturasReset: 0,
    };
  }

  // =============================================
  // MAVJUD CRUD METODLAR
  // =============================================

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

    if (typeof isActive === 'boolean') where.isActive = isActive;
    if (typeof processed === 'boolean') where.processed = processed;
    if (automationStatus) where.automationStatus = automationStatus;

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

  async getById(id: number) {
    const selectCheck = await SelectCheck.findByPk(id);
    if (!selectCheck) throw new Error('SelectCheck topilmadi');
    return selectCheck;
  }

  async create(data: SelectCheckCreationAttributes) {
    return await SelectCheck.create(data);
  }

  async update(id: number, data: Partial<SelectCheckCreationAttributes>) {
    const selectCheck = await this.getById(id);
    await selectCheck.update(data);
    return selectCheck;
  }

  async delete(id: number) {
    const selectCheck = await this.getById(id);
    await selectCheck.destroy();
    return { message: "SelectCheck o'chirildi" };
  }

  async bulkDelete(ids: number[]) {
    const deletedCount = await SelectCheck.destroy({
      where: { id: { [Op.in]: ids } },
    });
    return { deletedCount, message: `${deletedCount} ta o'chirildi` };
  }

  async bulkUpdateStatus(
    ids: number[],
    automationStatus: 'pending' | 'processing' | 'completed' | 'failed',
  ) {
    const [updatedCount] = await SelectCheck.update(
      { automationStatus },
      { where: { id: { [Op.in]: ids } } },
    );
    return { updatedCount, message: `${updatedCount} ta yangilandi` };
  }

  async toggleActive(id: number) {
    const selectCheck = await this.getById(id);
    selectCheck.isActive = !selectCheck.isActive;
    await selectCheck.save();
    return selectCheck;
  }

  async markAsProcessed(id: number) {
    const selectCheck = await this.getById(id);
    selectCheck.processed = true;
    selectCheck.automationStatus = 'completed';
    await selectCheck.save();
    return selectCheck;
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

  async getStatistics() {
    const total = await SelectCheck.count();
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
}
