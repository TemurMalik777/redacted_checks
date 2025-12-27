import { Op, WhereOptions } from 'sequelize';
import Decimal from 'decimal.js';
import SelectCheck, {
  SelectCheckAttributes,
  SelectCheckCreationAttributes,
} from './selectChecks.model';

// =============================================
// HELPER FUNCTIONS (Class'dan tashqarida)
// =============================================

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
  postTerminalSeria: string;
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

  // =============================================
  // FAKTURA-CHECK MOSLASHTIRISH
  // =============================================

  /**
   * Aktiv fakturalarni SANA BO'YICHA tartiblangan holda olish
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
   * Cheklar kombinatsiyasini topish (bosqich bo'yicha)
   * @param targetSumma - Faktura summasi
   * @param availableChecks - Mavjud cheklar
   * @param strategy - Qaysi bosqichni ishlatish: 1=teng, 2=ko'p, 3=kam
   */
  findBestChecksCombination(
    targetSumma: number,
    availableChecks: CheckRecord[],
    strategy: 1 | 2 | 3 = 1
  ): CombinationResult {
    const fakturaSumma = new Decimal(targetSumma);

    if (strategy === 1) {
      // ========================================
      // BOSQICH 1: Aniq teng
      // ========================================
      console.log(`      🔍 Bosqich 1: Aniq teng (${fakturaSumma.toFixed(2)})`);

      // 1.1: Bitta chek
      for (const check of availableChecks) {
        const checkSumma = new Decimal(check.chek_summa);
        if (checkSumma.equals(fakturaSumma)) {
          console.log(`      ✅ Topildi: 1 ta chek (aniq teng)`);
          return { checks: [check], totalSumma: checkSumma };
        }
      }

      // 1.2: Ko'p cheklar
      let selectedChecks: CheckRecord[] = [];
      let totalSumma = new Decimal(0);

      for (const check of availableChecks) {
        const checkSumma = new Decimal(check.chek_summa);

        if (totalSumma.plus(checkSumma).lte(fakturaSumma)) {
          selectedChecks.push(check);
          totalSumma = totalSumma.plus(checkSumma);

          if (totalSumma.equals(fakturaSumma)) {
            console.log(`      ✅ Topildi: ${selectedChecks.length} ta chek (aniq teng)`);
            return { checks: selectedChecks, totalSumma };
          }
        }
      }

      console.log(`      ❌ Bosqich 1 da topilmadi`);
      return { checks: [], totalSumma: new Decimal(0) };
    }

    if (strategy === 2) {
      // ========================================
      // BOSQICH 2: 0% dan 3% gacha ko'p
      // ========================================
      const max3Percent = fakturaSumma.times(1.03);

      console.log(`      🔍 Bosqich 2: 0% dan 3% gacha ko'p (${fakturaSumma.toFixed(2)} - ${max3Percent.toFixed(2)})`);

      // 2.1: Bitta chek
      for (const check of availableChecks) {
        const checkSumma = new Decimal(check.chek_summa);
        if (checkSumma.gt(fakturaSumma) && checkSumma.lte(max3Percent)) {
          console.log(`      ✅ Topildi: 1 ta chek`);
          return { checks: [check], totalSumma: checkSumma };
        }
      }

      // 2.2: Ko'p cheklar
      let selectedChecks: CheckRecord[] = [];
      let totalSumma = new Decimal(0);

      for (const check of availableChecks) {
        const checkSumma = new Decimal(check.chek_summa);

        if (totalSumma.plus(checkSumma).lte(max3Percent)) {
          selectedChecks.push(check);
          totalSumma = totalSumma.plus(checkSumma);

          if (totalSumma.gt(fakturaSumma) && totalSumma.lte(max3Percent)) {
            console.log(`      ✅ Topildi: ${selectedChecks.length} ta chek`);
            return { checks: selectedChecks, totalSumma };
          }
        }
      }

      console.log(`      ❌ Bosqich 2 da topilmadi`);
      return { checks: [], totalSumma: new Decimal(0) };
    }

    if (strategy === 3) {
      // ========================================
      // BOSQICH 3: 0% dan 2% gacha kam
      // ========================================
      const min2Percent = fakturaSumma.times(0.98);

      console.log(`      🔍 Bosqich 3: 0% dan 2% gacha kam (${min2Percent.toFixed(2)} - ${fakturaSumma.toFixed(2)})`);

      // 3.1: Bitta chek
      for (const check of availableChecks) {
        const checkSumma = new Decimal(check.chek_summa);
        if (checkSumma.gte(min2Percent) && checkSumma.lt(fakturaSumma)) {
          console.log(`      ✅ Topildi: 1 ta chek`);
          return { checks: [check], totalSumma: checkSumma };
        }
      }

      // 3.2: Ko'p cheklar
      let selectedChecks: CheckRecord[] = [];
      let totalSumma = new Decimal(0);

      for (const check of availableChecks) {
        const checkSumma = new Decimal(check.chek_summa);

        if (totalSumma.plus(checkSumma).lt(fakturaSumma)) {
          selectedChecks.push(check);
          totalSumma = totalSumma.plus(checkSumma);

          if (totalSumma.gte(min2Percent)) {
            console.log(`      ✅ Topildi: ${selectedChecks.length} ta chek`);
            return { checks: selectedChecks, totalSumma };
          }
        }
      }

      console.log(`      ❌ Bosqich 3 da ham topilmadi`);
      return { checks: [], totalSumma: new Decimal(0) };
    }

    return { checks: [], totalSumma: new Decimal(0) };
  }

  /**
   * Bitta fakturani qayta ishlash va select_checks ga yozish
   * @param strategy - Qaysi bosqichni ishlatish: 1=teng, 2=ko'p, 3=kam
   */
  async processFakturaItem(
    sequelize: any,
    fakturaItem: FakturaRecord,
    strategy: 1 | 2 | 3 = 1
  ): Promise<SelectCheck[]> {
    const transaction = await sequelize.transaction();

    try {
      const fakturaId = fakturaItem.id;
      const mxik = fakturaItem.mxik;
      const ulchov = fakturaItem.ulchov;
      const fakturaSumma = new Decimal(fakturaItem.faktura_summa);
      const fakturaMiqdor = new Decimal(fakturaItem.faktura_miqdor);
      
      // ✅ Date obyektiga aylantirish
      const fakturaSanaDate = parseDate(fakturaItem.creation_data_faktura);
      
      // ✅ String formatga o'tkazish (DD.MM.YYYY)
      const fakturaSanaStr = formatDate(fakturaSanaDate);

      console.log(`   📋 Faktura: MXIK=${mxik}, Ulchov=${ulchov}`);
      console.log(`      📅 Sana: ${fakturaSanaStr}`);
      console.log(`      💰 Faktura summa: ${fakturaSumma.toFixed(2)}`);

      // ✅ Date obyektini SQL query ga o'tkazamiz (limitSumma bo'lmasa barcha cheklar olinadi)
      const allChecks = await this.getUnprocessedChecksAfterDateRaw(
        sequelize,
        fakturaSanaDate
      );

      if (allChecks.length === 0) {
        console.log(`      ⚠️ Mos cheklar topilmadi (sana >= ${fakturaSanaStr}). Faktura is_active=true bo'lib qoladi`);
        await transaction.rollback();
        return [];
      }

      console.log(`      📦 ${allChecks.length} ta mos chek topildi`);

      const { checks: selectedChecks, totalSumma } = this.findBestChecksCombination(
        fakturaSumma.toNumber(),
        allChecks,
        strategy
      );

      if (selectedChecks.length === 0) {
        console.log(`      ⚠️ Hech qaysi bosqichda mos chek topilmadi. Faktura is_active=true bo'lib qoladi`);
        await transaction.rollback();
        return [];
      }

      console.log(`      ✅ Jami: ${selectedChecks.length} ta chek, summa: ${totalSumma.toFixed(2)}`)

      const birBirlik = totalSumma.div(fakturaMiqdor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      // Miqdorlarni hisoblash
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
        checkMiqdorlar[maxIndex].miqdor = checkMiqdorlar[maxIndex].miqdor.plus(difference);
      }

      // ✅ SelectCheck yaratish
      const results: SelectCheck[] = [];

      for (const item of checkMiqdorlar) {
        const { check, checkSumma, miqdor } = item;

        // ✅ Chek sanasini to'g'ri formatlash
        const checkSanaDate = parseDate(check.creation_date_check);
        const checkSanaStr = formatDate(checkSanaDate);

        const selectCheck = await SelectCheck.create({
          creationDataFaktura: fakturaSanaStr,  // ✅ DD.MM.YYYY
          creation_date_check: checkSanaStr,    // ✅ DD.MM.YYYY (soatsiz)
          postTerminalSeria: fakturaItem.postTerminalSeria,
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

        // Chekni processed qilish
        await sequelize.query(
          'UPDATE checks SET processed = true WHERE chek_raqam = :chekRaqam',
          { 
            replacements: { chekRaqam: check.chek_raqam },
            transaction 
          }
        );

        console.log(`         • Chek ${check.chek_raqam}: ${checkSumma.toFixed(2)} sum, ${miqdor.toFixed(6)} miqdor (${checkSanaStr})`);
      }

      // Fakturani deaktiv qilish
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
   */
  async processAllFakturas(sequelize: any): Promise<{
    results: SelectCheck[];
    processed: number;
    failed: number;
  }> {
    console.log('\n' + '='.repeat(70));
    console.log('🔄 FAKTURA QAYTA ISHLASH (3 BOSQICHLI)');
    console.log(`📊 Bosqich 1: Aniq teng | Bosqich 2: 0-3% ko'p | Bosqich 3: 0-2% kam`);
    console.log('='.repeat(70) + '\n');

    const allResults: SelectCheck[] = [];
    const maxAttempts = 3;
    const failedFakturas: Map<number, number> = new Map();
    let totalProcessed = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Har bir urinish uchun strategy belgilash
      const strategy = attempt as 1 | 2 | 3;
      const strategyNames = ['', 'Aniq teng', '0-3% ko\'p', '0-2% kam'];

      console.log(`\n🔁 Urinish #${attempt}/${maxAttempts} - ${strategyNames[strategy]}`);
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
        const sanaDate = parseDate(item.creation_data_faktura);
        const sanaStr = formatDate(sanaDate);

        console.log(`${idx + 1}. 📅 ${sanaStr} | MXIK: ${item.mxik} | Summa: ${item.faktura_summa.toLocaleString()}`);

        try {
          const results = await this.processFakturaItem(sequelize, item, strategy);

          if (results.length > 0) {
            allResults.push(...results);
            processedCount += results.length;
            totalProcessed += results.length;
            console.log(`   ✅ ${results.length} ta chek qayta ishlandi`);
            failedFakturas.delete(item.id);
          } else {
            console.log(`   ⚠️ Mos chek topilmadi`);
            failedFakturas.set(item.id, (failedFakturas.get(item.id) || 0) + 1);
          }
        } catch (error) {
          console.log(`   ❌ Xatolik:`, error);
          failedFakturas.set(item.id, (failedFakturas.get(item.id) || 0) + 1);
        }
        console.log();
      }

      console.log(`📊 ${attempt}-urinish (${strategyNames[strategy]}): ${processedCount} ta chek qayta ishlandi`);

      if (processedCount === 0 && attempt < maxAttempts) {
        console.log('⚠️ Hech narsa qayta ishlanmadi, keyingi urinish...');
      }
    }

    // Qayta ishlanmagan fakturalar soni
    const totalFailed = failedFakturas.size;

    // Qayta ishlanmagan fakturalar is_active=true bo'lib qoladi
    console.log(`\n⚠️ ${totalFailed} ta faktura uchun mos chek topilmadi, ular is_active=true holatida qoladi`);

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
   * Reset - barcha ma'lumotlarni tozalash
   */
  async resetAll(sequelize: any): Promise<{
    selectChecksDeleted: number;
    checksReset: number;
    fakturasReset: number;
  }> {
    console.log('\n⚠️ RESET JARAYONI...');

    const selectChecksDeleted = await SelectCheck.destroy({ where: {}, truncate: true });
    console.log(`   🗑️ select_checks tozalandi`);

    await sequelize.query('UPDATE checks SET processed = false');
    console.log(`   ♻️ Barcha cheklar processed=false`);

    await sequelize.query('UPDATE faktura SET is_active = true');
    console.log(`   ♻️ Barcha fakturalar is_active=true`);

    console.log('✅ Reset yakunlandi\n');

    return {
      selectChecksDeleted: selectChecksDeleted || 0,
      checksReset: 0,
      fakturasReset: 0,
    };
  }

  // =============================================
  // QOLGAN CRUD METODLAR (o'zgarishsiz)
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

  async getByUuid(uuid: string) {
    const selectCheck = await SelectCheck.findOne({ where: { uuid } });
    if (!selectCheck) throw new Error('SelectCheck topilmadi');
    return selectCheck;
  }

  async getByCheckNumber(chekRaqam: string) {
    return await SelectCheck.findAll({ where: { chekRaqam } });
  }

  async getByMxik(mxik: string) {
    return await SelectCheck.findAll({ where: { mxik } });
  }

  async create(data: SelectCheckCreationAttributes) {
    return await SelectCheck.create(data);
  }

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

    return {
      deletedCount,
      message: `${deletedCount} ta select_check o'chirildi`,
    };
  }

  async bulkUpdateStatus(
    ids: number[],
    automationStatus: 'pending' | 'processing' | 'completed' | 'failed',
  ) {
    const [updatedCount] = await SelectCheck.update(
      { automationStatus },
      { where: { id: { [Op.in]: ids } } },
    );

    return {
      updatedCount,
      message: `${updatedCount} ta select_check holati yangilandi`,
    };
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

  async getReadyForAutomation(limit: number = 10) {
    return await SelectCheck.findAll({
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
  }

  async getFailedRecords(limit: number = 20) {
    return await SelectCheck.findAll({
      where: {
        automationStatus: 'failed',
        errorMessage: { [Op.not]: null },
      },
      limit,
      order: [['updatedAt', 'DESC']],
    });
  }

  async setError(id: number, errorMessage: string) {
    const selectCheck = await this.getById(id);
    selectCheck.automationStatus = 'failed';
    selectCheck.errorMessage = errorMessage;
    await selectCheck.save();
    return selectCheck;
  }

  async resetForRetry(id: number) {
    const selectCheck = await this.getById(id);
    selectCheck.automationStatus = 'pending';
    selectCheck.errorMessage = undefined;
    selectCheck.processed = false;
    await selectCheck.save();
    return selectCheck;
  }

  async bulkResetForRetry(ids: number[]) {
    const [updatedCount] = await SelectCheck.update(
      {
        automationStatus: 'pending',
        errorMessage: undefined,
        processed: false,
      },
      { where: { id: { [Op.in]: ids } } },
    );

    return {
      updatedCount,
      message: `${updatedCount} ta select_check qayta urinish uchun tayyor`,
    };
  }

  async getStatistics() {
    const total = await SelectCheck.count();

    const byStatus = await SelectCheck.findAll({
      attributes: [
        'automationStatus',
        [SelectCheck.sequelize!.fn('COUNT', SelectCheck.sequelize!.col('id')), 'count'],
      ],
      group: ['automationStatus'],
      raw: true,
    });

    const active = await SelectCheck.count({ where: { isActive: true } });
    const processed = await SelectCheck.count({ where: { processed: true } });
    const pending = await SelectCheck.count({ where: { automationStatus: 'pending' } });
    const failed = await SelectCheck.count({ where: { automationStatus: 'failed' } });

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

  async getByDateRange(startDate: Date, endDate: Date) {
    return await SelectCheck.findAll({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
      },
      order: [['createdAt', 'DESC']],
    });
  }

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