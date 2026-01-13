import { Op, WhereOptions } from 'sequelize';
import Decimal from 'decimal.js';
import SelectCheck, {
  SelectCheckAttributes,
  SelectCheckCreationAttributes,
} from './selectChecks.model';
import logger, { createStageLogger } from '../../utils/logger'; // ✅ Winston logger

// =============================================
// HELPER FUNCTIONS
// =============================================

function parseDate(dateInput: any): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;

  const dateStr = String(dateInput).trim();

  if (dateStr === 'Invalid Date' || dateStr === '') {
    return new Date();
  }

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

/**
 * SelectChecksService - Ma'lumotlar bazasi bilan ishlash
 */
export class SelectChecksService {
  // =============================================
  // FAKTURA-CHECK MOSLASHTIRISH
  // =============================================

  async getActiveFakturasRaw(sequelize: any): Promise<FakturaRecord[]> {
    const [results] = await sequelize.query(`
      SELECT id, post_terminal_seria as "postTerminalSeria", mxik, ulchov, faktura_summa, faktura_miqdor, is_active, creation_data_faktura
      FROM faktura
      WHERE is_active = true
        AND faktura_summa > 0
        AND faktura_miqdor > 0
      ORDER BY creation_data_faktura ASC, faktura_summa DESC
    `);

    return results as FakturaRecord[];
  }

  async getUnprocessedChecksAfterDateRaw(
    sequelize: any,
    fakturaSana: Date,
    limitSumma?: number,
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
   * ✅ YANGI: 6-bosqich uchun - BARCHA qayta ishlanmagan cheklar (sana shartsiz)
   */
  async getAllUnprocessedChecksRaw(
    sequelize: any,
    limitSumma?: number,
  ): Promise<CheckRecord[]> {
    let query = `
      SELECT chek_raqam, chek_summa, maxsulot_nomi, creation_date_check
      FROM checks
      WHERE processed = false
    `;

    const replacements: any = {};

    if (limitSumma !== undefined) {
      query += ` AND chek_summa <= :limitSumma`;
      replacements.limitSumma = limitSumma;
    }

    query += ` ORDER BY creation_date_check ASC, chek_summa DESC`;

    const [results] = await sequelize.query(query, { replacements });
    return results as CheckRecord[];
  }

  /**
   * ✅ YANGI: 6 BOSQICHLI ALGORITM
   * 1 = Aniq teng (1 ta yoki ko'p chek)
   * 2 = 0-3% ko'p (FAQAT 1 ta chek)
   * 3 = 0-2% kam (FAQAT 1 ta chek)
   * 4 = 0-3% ko'p (ko'p chek yig'ish)
   * 5 = 0-2% kam (ko'p chek yig'ish)
   * 6 = BARCHA 5 ta usul, lekin sana shartsiz (oldingi cheklarni ham ishlatish)
   */
  findBestChecksCombination(
    targetSumma: number,
    availableChecks: CheckRecord[],
    strategy: 1 | 2 | 3 | 4 | 5 | 6 = 1,
  ): CombinationResult {
    const fakturaSumma = new Decimal(targetSumma);
    const stageLogger = createStageLogger(strategy);

    // ============================================
    // BOSQICH 1: ANIQ TENG (1 ta yoki ko'p chek)
    // ============================================
    if (strategy === 1) {
      const message = `      🔍 Bosqich 1: Aniq teng (${fakturaSumma.toFixed(2)})`;
      console.log(message);
      logger.info(message);
      stageLogger.info(message);

      // 1.1: Bitta chek
      for (const check of availableChecks) {
        const checkSumma = new Decimal(check.chek_summa);
        if (checkSumma.equals(fakturaSumma)) {
          const msg = `      ✅ Topildi: 1 ta chek (aniq teng) - ${check.chek_raqam}: ${checkSumma.toFixed(2)}`;
          console.log(msg);
          logger.info(msg);
          stageLogger.info(msg);
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
            const msg = `      ✅ Topildi: ${selectedChecks.length} ta chek (aniq teng), jami: ${totalSumma.toFixed(2)}`;
            console.log(msg);
            logger.info(msg);
            stageLogger.info(msg);
            return { checks: selectedChecks, totalSumma };
          }
        }
      }

      const msg = `      ❌ Bosqich 1 da topilmadi`;
      console.log(msg);
      logger.info(msg);
      stageLogger.warn(msg);
      return { checks: [], totalSumma: new Decimal(0) };
    }

    // ============================================
    // BOSQICH 2: 0-3% KO'P (FAQAT 1 TA CHEK)
    // ============================================
    if (strategy === 2) {
      const max3Percent = fakturaSumma.times(1.03);

      const message = `      🔍 Bosqich 2: 0-3% ko'p, FAQAT 1 ta chek (${fakturaSumma.toFixed(2)} - ${max3Percent.toFixed(2)})`;
      console.log(message);
      logger.info(message);
      stageLogger.info(message);

      // FAQAT bitta chek qidirish
      for (const check of availableChecks) {
        const checkSumma = new Decimal(check.chek_summa);
        if (checkSumma.gt(fakturaSumma) && checkSumma.lte(max3Percent)) {
          const msg = `      ✅ Topildi: 1 ta chek - ${check.chek_raqam}: ${checkSumma.toFixed(2)}`;
          console.log(msg);
          logger.info(msg);
          stageLogger.info(msg);
          return { checks: [check], totalSumma: checkSumma };
        }
      }

      const msg = `      ❌ Bosqich 2 da topilmadi (1 ta chek)`;
      console.log(msg);
      logger.info(msg);
      stageLogger.warn(msg);
      return { checks: [], totalSumma: new Decimal(0) };
    }

    // ============================================
    // BOSQICH 3: 0-2% KAM (FAQAT 1 TA CHEK)
    // ============================================
    if (strategy === 3) {
      const min2Percent = fakturaSumma.times(0.98);

      const message = `      🔍 Bosqich 3: 0-2% kam, FAQAT 1 ta chek (${min2Percent.toFixed(2)} - ${fakturaSumma.toFixed(2)})`;
      console.log(message);
      logger.info(message);
      stageLogger.info(message);

      // FAQAT bitta chek qidirish
      for (const check of availableChecks) {
        const checkSumma = new Decimal(check.chek_summa);
        if (checkSumma.gte(min2Percent) && checkSumma.lt(fakturaSumma)) {
          const msg = `      ✅ Topildi: 1 ta chek - ${check.chek_raqam}: ${checkSumma.toFixed(2)}`;
          console.log(msg);
          logger.info(msg);
          stageLogger.info(msg);
          return { checks: [check], totalSumma: checkSumma };
        }
      }

      const msg = `      ❌ Bosqich 3 da topilmadi (1 ta chek)`;
      console.log(msg);
      logger.info(msg);
      stageLogger.warn(msg);
      return { checks: [], totalSumma: new Decimal(0) };
    }

    // ============================================
    // BOSQICH 4: 0-3% KO'P (KO'P CHEK YIG'ISH)
    // ============================================
    if (strategy === 4) {
      const max3Percent = fakturaSumma.times(1.03);

      const message = `      🔍 Bosqich 4: 0-3% ko'p, KO'P CHEK yig'ish (${fakturaSumma.toFixed(2)} - ${max3Percent.toFixed(2)})`;
      console.log(message);
      logger.info(message);
      stageLogger.info(message);

      let selectedChecks: CheckRecord[] = [];
      let totalSumma = new Decimal(0);

      for (const check of availableChecks) {
        const checkSumma = new Decimal(check.chek_summa);

        if (totalSumma.plus(checkSumma).lte(max3Percent)) {
          selectedChecks.push(check);
          totalSumma = totalSumma.plus(checkSumma);

          // Agar faktura_summa dan ko'p va 3% ichida bo'lsa - to'xta
          if (totalSumma.gt(fakturaSumma) && totalSumma.lte(max3Percent)) {
            const msg = `      ✅ Topildi: ${selectedChecks.length} ta chek, jami: ${totalSumma.toFixed(2)}`;
            console.log(msg);
            logger.info(msg);
            stageLogger.info(msg);
            return { checks: selectedChecks, totalSumma };
          }
        }
      }

      const msg = `      ❌ Bosqich 4 da topilmadi (ko'p chek)`;
      console.log(msg);
      logger.info(msg);
      stageLogger.warn(msg);
      return { checks: [], totalSumma: new Decimal(0) };
    }

    // ============================================
    // BOSQICH 5: 0-2% KAM (KO'P CHEK YIG'ISH)
    // ============================================
    if (strategy === 5) {
      const min2Percent = fakturaSumma.times(0.98);

      const message = `      🔍 Bosqich 5: 0-2% kam, KO'P CHEK yig'ish (${min2Percent.toFixed(2)} - ${fakturaSumma.toFixed(2)})`;
      console.log(message);
      logger.info(message);
      stageLogger.info(message);

      let selectedChecks: CheckRecord[] = [];
      let totalSumma = new Decimal(0);

      for (const check of availableChecks) {
        const checkSumma = new Decimal(check.chek_summa);

        if (totalSumma.plus(checkSumma).lt(fakturaSumma)) {
          selectedChecks.push(check);
          totalSumma = totalSumma.plus(checkSumma);

          // Agar 98% dan ko'p va faktura_summa dan kam bo'lsa - to'xta
          if (totalSumma.gte(min2Percent)) {
            const msg = `      ✅ Topildi: ${selectedChecks.length} ta chek, jami: ${totalSumma.toFixed(2)}`;
            console.log(msg);
            logger.info(msg);
            stageLogger.info(msg);
            return { checks: selectedChecks, totalSumma };
          }
        }
      }

      const msg = `      ❌ Bosqich 5 da topilmadi (ko'p chek)`;
      console.log(msg);
      logger.info(msg);
      stageLogger.warn(msg);
      return { checks: [], totalSumma: new Decimal(0) };
    }

    return { checks: [], totalSumma: new Decimal(0) };
  }

  async processFakturaItem(
    sequelize: any,
    fakturaItem: FakturaRecord,
    strategy: 1 | 2 | 3 | 4 | 5 | 6 = 1,
    ignoreDateFilter: boolean = false, // ✅ YANGI: 6-bosqich uchun
  ): Promise<SelectCheck[]> {
    const stageLogger = createStageLogger(strategy > 5 ? 1 : strategy as 1 | 2 | 3 | 4 | 5);

    // ✅ YANGI: 0 summali fakturalarni o'tkazib yuborish
    if (fakturaItem.faktura_summa <= 0 || fakturaItem.faktura_miqdor <= 0) {
      const msg = `   ⚠️ Faktura ID=${fakturaItem.id} summa yoki miqdor 0 yoki manfiy, o'tkazib yuborildi`;
      console.log(msg);
      logger.warn(msg);
      stageLogger.warn(msg);
      return [];
    }

    // ✅ YANGI: Connection mavjudligini tekshirish
    try {
      await sequelize.authenticate();
    } catch (error) {
      const errMsg = `❌ Database connection yopilgan, qayta ishlash to'xtatildi`;
      console.error(errMsg);
      logger.error(errMsg, { error });
      stageLogger.error(errMsg, { error });
      throw new Error('Database connection closed');
    }

    const transaction = await sequelize.transaction();

    try {
      const fakturaId = fakturaItem.id;
      const mxik = fakturaItem.mxik;
      const ulchov = fakturaItem.ulchov;
      const fakturaSumma = new Decimal(fakturaItem.faktura_summa);
      const fakturaMiqdor = new Decimal(fakturaItem.faktura_miqdor);

      const fakturaSanaDate = parseDate(fakturaItem.creation_data_faktura);
      const fakturaSanaStr = formatDate(fakturaSanaDate);

      const log1 = `   📋 Faktura ID=${fakturaId}: MXIK=${mxik}, Ulchov=${ulchov}`;
      const log2 = `      📅 Sana: ${fakturaSanaStr}`;
      const log3 = `      💰 Faktura summa: ${fakturaSumma.toFixed(2)}, Miqdor: ${fakturaMiqdor.toFixed(6)}`;
      
      console.log(log1);
      console.log(log2);
      console.log(log3);
      logger.info(log1);
      logger.info(log2);
      logger.info(log3);
      stageLogger.info(log1);
      stageLogger.info(log2);
      stageLogger.info(log3);

      // ✅ YANGI: 6-bosqichda barcha cheklarni olish (sana shartsiz)
      const allChecks = ignoreDateFilter 
        ? await this.getAllUnprocessedChecksRaw(sequelize)
        : await this.getUnprocessedChecksAfterDateRaw(sequelize, fakturaSanaDate);

      if (allChecks.length === 0) {
        const msg = `      ⚠️ Mos cheklar topilmadi (sana >= ${fakturaSanaStr}). Faktura is_active=true bo'lib qoladi`;
        console.log(msg);
        logger.warn(msg);
        stageLogger.warn(msg);
        await transaction.rollback();
        return [];
      }

      const log4 = `      📦 ${allChecks.length} ta mos chek topildi`;
      console.log(log4);
      logger.info(log4);
      stageLogger.info(log4);

      const { checks: selectedChecks, totalSumma } = this.findBestChecksCombination(
        fakturaSumma.toNumber(),
        allChecks,
        strategy,
      );

      if (selectedChecks.length === 0) {
        const msg = `      ⚠️ Ushbu bosqichda mos chek topilmadi. Faktura is_active=true bo'lib qoladi`;
        console.log(msg);
        logger.warn(msg);
        stageLogger.warn(msg);
        await transaction.rollback();
        return [];
      }

      const log5 = `      ✅ Jami: ${selectedChecks.length} ta chek, summa: ${totalSumma.toFixed(2)}`;
      console.log(log5);
      logger.info(log5);
      stageLogger.info(log5);

      const birBirlik = totalSumma.div(fakturaMiqdor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const log6 = `      💡 Bir birlik: ${birBirlik.toFixed(2)}`;
      console.log(log6);
      logger.info(log6);
      stageLogger.info(log6);

      const checkMiqdorlar: { check: CheckRecord; checkSumma: Decimal; miqdor: Decimal }[] = [];
      let totalMiqdorUsed = new Decimal(0);

      for (const check of selectedChecks) {
        const checkSumma = new Decimal(check.chek_summa);
        let miqdor = checkSumma.div(birBirlik);
        miqdor = miqdor.times(1000000).floor().div(1000000);

        checkMiqdorlar.push({ check, checkSumma, miqdor });
        totalMiqdorUsed = totalMiqdorUsed.plus(miqdor);
      }

      const difference = fakturaMiqdor.minus(totalMiqdorUsed);
      if (difference.abs().gt(0.000001) && checkMiqdorlar.length > 0) {
        let maxIndex = 0;
        let maxSummaVal = new Decimal(0);
        checkMiqdorlar.forEach((item, idx) => {
          if (item.checkSumma.gt(maxSummaVal)) {
            maxSummaVal = item.checkSumma;
            maxIndex = idx;
          }
        });
        checkMiqdorlar[maxIndex].miqdor = checkMiqdorlar[maxIndex].miqdor.plus(difference);

        const log7 = `      🔧 Farq tuzatildi: ${difference.toFixed(6)} (chek: ${checkMiqdorlar[maxIndex].check.chek_raqam})`;
        console.log(log7);
        logger.info(log7);
        stageLogger.info(log7);
      }

      const results: SelectCheck[] = [];

      for (const item of checkMiqdorlar) {
        const { check, checkSumma, miqdor } = item;

        const checkSanaDate = parseDate(check.creation_date_check);
        const checkSanaStr = formatDate(checkSanaDate);

        const selectCheck = await SelectCheck.create(
          {
            creationDataFaktura: fakturaSanaStr,
            creation_date_check: checkSanaStr,
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
          },
          { transaction },
        );

        results.push(selectCheck);

        await sequelize.query('UPDATE checks SET processed = true WHERE chek_raqam = :chekRaqam', {
          replacements: { chekRaqam: check.chek_raqam },
          transaction,
        });

        const log8 = `         • Chek ${check.chek_raqam}: ${checkSumma.toFixed(2)} sum → ${miqdor.toFixed(6)} miqdor (${checkSanaStr})`;
        console.log(log8);
        logger.info(log8);
        stageLogger.info(log8);
      }

      await sequelize.query('UPDATE faktura SET is_active = false WHERE id = :fakturaId', {
        replacements: { fakturaId },
        transaction,
      });

      const log9 = `      ✅ Faktura ID=${fakturaId} is_active=false qilindi`;
      console.log(log9);
      logger.info(log9);
      stageLogger.info(log9);

      await transaction.commit();
      return results;
    } catch (error) {
      await transaction.rollback();
      const errMsg = `❌ processFakturaItem xatosi`;
      console.error(errMsg, error);
      logger.error(errMsg, { error });
      stageLogger.error(errMsg, { error });
      throw error;
    }
  }

  /**
   * ✅ YANGI: Barcha aktiv fakturalarni 6 bosqichda qayta ishlash
   * Bosqich 1-5: Faktura sanasidan keyin kelgan cheklar
   * Bosqich 6: BARCHA cheklar (oldingi sanalarni ham ishlatish)
   */
  async processAllFakturas(sequelize: any): Promise<{
    results: SelectCheck[];
    processed: number;
    failed: number;
  }> {
    const separator = '='.repeat(70);
    const line = '─'.repeat(70);

    console.log('\n' + separator);
    console.log('🔄 FAKTURA QAYTA ISHLASH (6 BOSQICHLI ALGORITM)');
    console.log(separator);
    console.log('📊 Bosqich 1: ANIQ TENG (faktura sanasidan keyin)');
    console.log("📊 Bosqich 2: 0-3% KO'P, 1 TA CHEK (faktura sanasidan keyin)");
    console.log('📊 Bosqich 3: 0-2% KAM, 1 TA CHEK (faktura sanasidan keyin)');
    console.log("📊 Bosqich 4: 0-3% KO'P, KO'P CHEK (faktura sanasidan keyin)");
    console.log("📊 Bosqich 5: 0-2% KAM, KO'P CHEK (faktura sanasidan keyin)");
    console.log("📊 Bosqich 6: BARCHA USULLAR, BARCHA CHEKLAR (sana shartsiz)");
    console.log(separator + '\n');

    logger.info(separator);
    logger.info('🔄 FAKTURA QAYTA ISHLASH (6 BOSQICHLI ALGORITM)');
    logger.info(separator);
    logger.info('📊 Bosqich 1: ANIQ TENG (faktura sanasidan keyin)');
    logger.info("📊 Bosqich 2: 0-3% KO'P, 1 TA CHEK (faktura sanasidan keyin)");
    logger.info('📊 Bosqich 3: 0-2% KAM, 1 TA CHEK (faktura sanasidan keyin)');
    logger.info("📊 Bosqich 4: 0-3% KO'P, KO'P CHEK (faktura sanasidan keyin)");
    logger.info("📊 Bosqich 5: 0-2% KAM, KO'P CHEK (faktura sanasidan keyin)");
    logger.info("📊 Bosqich 6: BARCHA USULLAR, BARCHA CHEKLAR (sana shartsiz)");
    logger.info(separator);

    const allResults: SelectCheck[] = [];
    const maxAttempts = 6; // ✅ 6 bosqich
    let totalProcessed = 0;

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const strategy = (attempt <= 5 ? attempt : 1) as 1 | 2 | 3 | 4 | 5 | 6;
        const ignoreDateFilter = attempt === 6; // ✅ 6-bosqichda sana filtrini o'chirish
        
        const stageLogger = createStageLogger(strategy > 5 ? 1 : strategy as 1 | 2 | 3 | 4 | 5);
        
        const strategyNames = [
          '', 
          '🎯 ANIQ TENG', 
          "📈 0-3% KO'P (1 TA)", 
          '📉 0-2% KAM (1 TA)',
          "🔢 0-3% KO'P (KO'P)",
          "🔢 0-2% KAM (KO'P)",
          "🌐 BARCHA USULLAR (SANA SHARTSIZ)"
        ];

        console.log(`\n${separator}`);
        console.log(`🔁 BOSQICH ${attempt}/${maxAttempts}: ${strategyNames[attempt] || strategyNames[strategy]}`);
        if (ignoreDateFilter) {
          console.log('   🔓 Sana filtri o\'chirilgan - oldingi cheklarni ham ishlatish');
        }
        console.log(separator);

        logger.info(`\n${separator}`);
        logger.info(`🔁 BOSQICH ${attempt}/${maxAttempts}: ${strategyNames[attempt] || strategyNames[strategy]}`);
        if (ignoreDateFilter) {
          logger.info('   🔓 Sana filtri o\'chirilgan - oldingi cheklarni ham ishlatish');
        }
        logger.info(separator);

        stageLogger.info(`\n${separator}`);
        stageLogger.info(`🔁 BOSQICH ${attempt}/${maxAttempts}: ${strategyNames[attempt] || strategyNames[strategy]} - BOSHLANDI`);
        if (ignoreDateFilter) {
          stageLogger.info('   🔓 Sana filtri o\'chirilgan - oldingi cheklarni ham ishlatish');
        }
        stageLogger.info(separator);

        const fakturaItems = await this.getActiveFakturasRaw(sequelize);

        if (fakturaItems.length === 0) {
          const msg = `✅ Aktiv faktura topilmadi, ${attempt}-bosqich tugadi\n`;
          console.log(msg);
          logger.info(msg);
          stageLogger.info(msg);
          break;
        }

        const log1 = `📋 ${fakturaItems.length} ta aktiv faktura (sana bo'yicha tartiblangan)\n`;
        console.log(log1);
        logger.info(log1);
        stageLogger.info(log1);

        let processedInThisRound = 0;

        // ✅ 6-bosqichda barcha 5 ta usulni ketma-ket sinash
        if (attempt === 6) {
          for (let idx = 0; idx < fakturaItems.length; idx++) {
            const item = fakturaItems[idx];
            const sanaDate = parseDate(item.creation_data_faktura);
            const sanaStr = formatDate(sanaDate);

            let fakturaProcessed = false;

            // Har bir faktura uchun 5 ta usulni sinash
            for (let subStrategy = 1; subStrategy <= 5; subStrategy++) {
              const log2 = `\n${idx + 1}. 📅 ${sanaStr} | MXIK: ${item.mxik} | Summa: ${item.faktura_summa.toLocaleString()} | Miqdor: ${item.faktura_miqdor} (Usul: ${subStrategy}/5)`;
              console.log(log2);
              logger.info(log2);
              stageLogger.info(log2);

              try {
                try {
                  await sequelize.authenticate();
                } catch (connError) {
                  const errMsg = `   ❌ Database connection yopilgan, jarayon to'xtatildi`;
                  console.error(errMsg);
                  logger.error(errMsg, { error: connError });
                  stageLogger.error(errMsg, { error: connError });
                  fakturaProcessed = false;
                  break; // Ichki loopdan chiqish
                }

                const results = await this.processFakturaItem(sequelize, item, subStrategy as 1 | 2 | 3 | 4 | 5 | 6, true);

                if (results.length > 0) {
                  allResults.push(...results);
                  processedInThisRound++;
                  totalProcessed++;
                  fakturaProcessed = true;
                  const msg = `   ✅ Muvaffaqiyatli! ${results.length} ta select_check yaratildi (Usul ${subStrategy})`;
                  console.log(msg);
                  logger.info(msg);
                  stageLogger.info(msg);
                  break; // Bu faktura uchun keyingi usulni sinash kerak emas
                }
              } catch (error: any) {
                if (error?.message?.includes('connection') || error?.message?.includes('closed')) {
                  const errMsg = `   ❌ Database connection muammosi, jarayon to'xtatildi`;
                  console.error(errMsg, error);
                  logger.error(errMsg, { error });
                  stageLogger.error(errMsg, { error });
                  fakturaProcessed = false;
                  break; // Ichki loopdan chiqish
                }

                const errMsg = `   ❌ Xatolik yuz berdi (Usul ${subStrategy})`;
                console.error(errMsg, error);
                logger.error(errMsg, { error });
                stageLogger.error(errMsg, { error });
                // Keyingi usulni sinash uchun davom etish
              }
            }

            // Agar connection error bo'lsa, tashqi loopdan ham chiqish
            if (!fakturaProcessed) {
              try {
                await sequelize.authenticate();
              } catch (connError) {
                break; // Tashqi loopdan chiqish
              }
            }
          }
        } else {
          // Bosqich 1-5: oddiy ishlash
          for (let idx = 0; idx < fakturaItems.length; idx++) {
            const item = fakturaItems[idx];
            const sanaDate = parseDate(item.creation_data_faktura);
            const sanaStr = formatDate(sanaDate);

            const log2 = `\n${idx + 1}. 📅 ${sanaStr} | MXIK: ${item.mxik} | Summa: ${item.faktura_summa.toLocaleString()} | Miqdor: ${item.faktura_miqdor}`;
            console.log(log2);
            logger.info(log2);
            stageLogger.info(log2);

            try {
              try {
                await sequelize.authenticate();
              } catch (connError) {
                const errMsg = `   ❌ Database connection yopilgan, jarayon to'xtatildi`;
                console.error(errMsg);
                logger.error(errMsg, { error: connError });
                stageLogger.error(errMsg, { error: connError });
                break;
              }

              const results = await this.processFakturaItem(sequelize, item, strategy, ignoreDateFilter);

              if (results.length > 0) {
                allResults.push(...results);
                processedInThisRound++;
                totalProcessed++;
                const msg = `   ✅ Muvaffaqiyatli! ${results.length} ta select_check yaratildi`;
                console.log(msg);
                logger.info(msg);
                stageLogger.info(msg);
              } else {
                const msg = `   ⚠️ Ushbu bosqichda mos chek topilmadi, keyingi bosqichda qayta uriniladi`;
                console.log(msg);
                logger.warn(msg);
                stageLogger.warn(msg);
              }
            } catch (error: any) {
              if (error?.message?.includes('connection') || error?.message?.includes('closed')) {
                const errMsg = `   ❌ Database connection muammosi, jarayon to'xtatildi`;
                console.error(errMsg, error);
                logger.error(errMsg, { error });
                stageLogger.error(errMsg, { error });
                break;
              }

              const errMsg = `   ❌ Xatolik yuz berdi`;
              console.error(errMsg, error);
              logger.error(errMsg, { error });
              stageLogger.error(errMsg, { error });
            }
          }
        }

        console.log(`\n${line}`);
        console.log(`📊 ${attempt}-bosqich yakunlandi: ${processedInThisRound} ta faktura qayta ishlandi`);
        console.log(line);

        logger.info(`\n${line}`);
        logger.info(`📊 ${attempt}-bosqich yakunlandi: ${processedInThisRound} ta faktura qayta ishlandi`);
        logger.info(line);

        stageLogger.info(`\n${line}`);
        stageLogger.info(`📊 ${attempt}-BOSQICH YAKUNLANDI: ${processedInThisRound} ta faktura qayta ishlandi`);
        stageLogger.info(line);

        if (processedInThisRound === 0) {
          const msg = `⚠️ ${attempt}-bosqichda hech qanday faktura qayta ishlanmadi, keyingi bosqichga o'tiladi...\n`;
          console.log(msg);
          logger.warn(msg);
          stageLogger.warn(msg);
        }
      }

      const remainingFakturas = await this.getActiveFakturasRaw(sequelize);
      const totalFailed = remainingFakturas.length;

      console.log('\n' + separator);
      console.log('📈 YAKUNIY NATIJA');
      console.log(separator);
      console.log(`✅ Jami yaratilgan select_checks: ${allResults.length}`);
      console.log(`✅ Muvaffaqiyatli qayta ishlangan fakturalar: ${totalProcessed}`);
      console.log(`⚠️ Qayta ishlanmagan fakturalar (is_active=true): ${totalFailed}`);

      logger.info('\n' + separator);
      logger.info('📈 YAKUNIY NATIJA');
      logger.info(separator);
      logger.info(`✅ Jami yaratilgan select_checks: ${allResults.length}`);
      logger.info(`✅ Muvaffaqiyatli qayta ishlangan fakturalar: ${totalProcessed}`);
      logger.info(`⚠️ Qayta ishlanmagan fakturalar (is_active=true): ${totalFailed}`);

      if (totalFailed > 0) {
        console.log(`\n⚠️ Quyidagi fakturalar uchun mos chek topilmadi:`);
        logger.warn(`\n⚠️ Quyidagi fakturalar uchun mos chek topilmadi:`);
        
        remainingFakturas.forEach((f, idx) => {
          const sana = formatDate(parseDate(f.creation_data_faktura));
          const msg = `   ${idx + 1}. ID=${f.id} | ${sana} | MXIK=${f.mxik} | Summa=${f.faktura_summa}`;
          console.log(msg);
          logger.warn(msg);
        });
      }

      console.log(separator + '\n');
      logger.info(separator + '\n');

      return {
        results: allResults,
        processed: totalProcessed,
        failed: totalFailed,
      };
    } catch (error) {
      const errMsg = 'processAllFakturas da umumiy xato';
      console.error(errMsg, error);
      logger.error(errMsg, { error });
      throw error;
    }
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
    logger.info('\n⚠️ RESET JARAYONI...');

    const selectChecksDeleted = await SelectCheck.destroy({
      where: {},
      truncate: true,
    });
    console.log(`   🗑️ select_checks tozalandi`);
    logger.info(`   🗑️ select_checks tozalandi`);

    await sequelize.query('UPDATE checks SET processed = false');
    console.log(`   ♻️ Barcha cheklar processed=false`);
    logger.info(`   ♻️ Barcha cheklar processed=false`);

    await sequelize.query('UPDATE faktura SET is_active = true');
    console.log(`   ♻️ Barcha fakturalar is_active=true`);
    logger.info(`   ♻️ Barcha fakturalar is_active=true`);

    console.log('✅ Reset yakunlandi\n');
    logger.info('✅ Reset yakunlandi\n');

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

  /**
   * 🤖 Automation uchun tayyor select_check'larni olish
   *
   * Quyidagi shartlarga mos select_check'larni qaytaradi:
   * - isActive = true
   * - automationStatus = 'pending' yoki 'failed'
   * - processed = false
   * - Barcha majburiy maydonlar to'ldirilgan
   */
  async getAllForAutomation() {
    const selectChecks = await SelectCheck.findAll({
      where: {
        isActive: true,
        processed: false,
        automationStatus: {
          [Op.in]: ['pending', 'failed'],
        },
      },
      order: [['createdAt', 'ASC']],
      limit: 100, // Bir safarda maksimal 100 ta
    });

    // Faqat barcha majburiy maydonlar to'ldirilganlarini filter qilamiz
    const validChecks = selectChecks.filter(
      (sc) => sc.chekRaqam && sc.mxik && sc.ulchov
    );

    logger.info(`📊 Automation uchun ${validChecks.length} ta select_check topildi`);

    return validChecks.map((sc) => ({
      id: sc.id,
      chek_raqam: sc.chekRaqam,
      mxik: sc.mxik,
      ulchov: sc.ulchov,
      miqdor: sc.miqdor,
      amount: sc.umumiyChekSumma,
      bir_birlik: sc.birBirlik,
    }));
  }

  /**
   * 🔄 Automation uchun select_check'larni tayyor qilish
   *
   * Quyidagi shartlarga mos select_check'larni isActive=true qiladi:
   * - processed = false
   * - automationStatus = 'pending'
   * - Barcha majburiy maydonlar to'ldirilgan
   */
  async prepareForAutomation(limit: number = 100): Promise<{ updated: number; total: number }> {
    try {
      logger.info(`🔄 Automation uchun select_check'lar tayyor qilinmoqda (limit: ${limit})...`);

      // 1. Shartlarga mos select_check'larni topish
      const selectChecks = await SelectCheck.findAll({
        where: {
          isActive: false,
          processed: false,
          automationStatus: 'pending',
        },
        limit,
        order: [['createdAt', 'ASC']],
      });

      // 2. Faqat barcha majburiy maydonlar to'ldirilganlarini filter qilish
      const validChecks = selectChecks.filter(
        (sc) => sc.chekRaqam && sc.mxik && sc.ulchov
      );

      if (validChecks.length === 0) {
        logger.warn('⚠️ Tayyor qilish uchun select_check topilmadi');
        return { updated: 0, total: 0 };
      }

      // 3. Ularni isActive=true qilish
      const ids = validChecks.map((sc) => sc.id);
      const [updatedCount] = await SelectCheck.update(
        { isActive: true },
        { where: { id: { [Op.in]: ids } } }
      );

      logger.info(`✅ ${updatedCount} ta select_check isActive=true qilindi`);

      return {
        updated: updatedCount,
        total: validChecks.length,
      };
    } catch (error) {
      logger.error('❌ prepareForAutomation xatosi:', error);
      throw error;
    }
  }
}