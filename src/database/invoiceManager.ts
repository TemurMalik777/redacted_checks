import { DbManager, SelectCheckData } from './checkImporter';
import { logger } from '../automation/utils/logUtils';
import { IncomingMessage } from 'http';

export interface InvoiceItem {
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
}

export class InvoiceManager {
  private dbManager: DbManager;

  constructor() {
    this.dbManager = new DbManager();
  }

  /**
   * Database ga ulanish
   */
  async connect(): Promise<void> {
    await this.dbManager.connect();
  }

  /**
   * Ulanishni yopish
   */
  async disconnect(): Promise<void> {
    await this.dbManager.disconnect();
  }

  /**
   * Jarayon qilish uchun cheklar olish
   */
  async getUnprocessedChecks(limit: number = 10): Promise<any[]> {
    const result = await this.dbManager.query(
      `
            SELECT * FROM checks 
            WHERE processed = false 
            ORDER BY created_at ASC 
            LIMIT $1
        `,
      [limit],
    );

    return result.rows;
  }

  /**
   * Active fakturalarni olish
   */
  async getActiveFakturas(): Promise<any[]> {
    const result = await this.dbManager.query(`
            SELECT * FROM faktura 
            WHERE is_active = true 
            ORDER BY created_at ASC
        `);

    return result.rows;
  }

  /**
   * MXIK bo'yicha faktura qidirish
   */
  async findFakturaByMxik(mxik: string): Promise<any | null> {
    const result = await this.dbManager.query(
      `
            SELECT * FROM faktura 
            WHERE mxik = $1 AND is_active = true 
            LIMIT 1
        `,
      [mxik],
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Faktura summasiga mos cheklarni topish va yig'ish
   * 3 xil usulda qidiradi:
   * 1. faktura_summa == chek_summa (bitta chek to'liq mos)
   * 2. faktura_summa == umumiy_chek_summa (bir necha chek summasi to'liq teng)
   * 3. faktura_summa == umumiy_chek_summa (+0.1% dan 1% gacha farq)
   */
  async findMatchingChecksForFaktura(faktura: any): Promise<any[]> {
    const fakturaSumma = parseFloat(faktura.faktura_summa);
    const mxik = faktura.mxik;

    // 1. Bitta chek to'liq mos kelishi
    const exactMatch = await this.dbManager.query(
      `
            SELECT * FROM checks 
            WHERE processed = false 
            AND ABS(chek_summa - $1) < 0.01
            ORDER BY created_at ASC
            LIMIT 1
        `,
      [fakturaSumma],
    );

    if (exactMatch.rows.length > 0) {
      logger.info(
        `✅ Bitta chek to'liq mos keldi: ${exactMatch.rows[0].chek_raqam}`,
      );
      return exactMatch.rows;
    }

    // 2. Bir necha chekni yig'ish (to'liq teng)
    const allChecks = await this.dbManager.query(
      `
            SELECT * FROM checks 
            WHERE processed = false 
            ORDER BY created_at ASC
        `,
    );

    const checks = allChecks.rows;
    const matchingChecks = this.findCheckCombination(
      checks,
      fakturaSumma,
      0.01,
    );

    if (matchingChecks.length > 0) {
      const totalSum = matchingChecks.reduce(
        (sum, check) => sum + parseFloat(check.chek_summa),
        0,
      );
      logger.info(
        `✅ ${
          matchingChecks.length
        } ta chek yig'indisi mos keldi: ${totalSum.toFixed(
          2,
        )} ≈ ${fakturaSumma}`,
      );
      return matchingChecks;
    }

    // 3. Bir necha chekni yig'ish (+0.1% dan 1% gacha farq)
    const tolerantChecks = this.findCheckCombination(
      checks,
      fakturaSumma,
      fakturaSumma * 0.01, // 1% tolerance
      fakturaSumma * 0.001, // 0.1% minimum
    );

    if (tolerantChecks.length > 0) {
      const totalSum = tolerantChecks.reduce(
        (sum, check) => sum + parseFloat(check.chek_summa),
        0,
      );
      const difference = totalSum - fakturaSumma;
      const percentage = ((difference / fakturaSumma) * 100).toFixed(2);

      logger.info(
        `✅ ${
          tolerantChecks.length
        } ta chek yig'indisi mos keldi (${percentage}% farq): ${totalSum.toFixed(
          2,
        )} ≈ ${fakturaSumma}`,
      );
      return tolerantChecks;
    }

    logger.warning(`⚠️ Faktura uchun mos cheklar topilmadi: ${fakturaSumma}`);
    return [];
  }

  /**
   * Cheklar kombinatsiyasini topish (greedy algorithm)
   * Target summaga yaqin bo'lgan cheklar to'plamini qaytaradi
   */
  private findCheckCombination(
    checks: any[],
    targetSum: number,
    maxTolerance: number,
    minTolerance: number = 0,
  ): any[] {
    // Cheklarni summaga ko'ra sortirlash (katta -> kichik)
    const sortedChecks = [...checks].sort(
      (a, b) => parseFloat(b.chek_summa) - parseFloat(a.chek_summa),
    );

    // Greedy yondashuv: eng yaqin kombinatsiyani topish
    let bestCombination: any[] = [];
    let bestDifference = Infinity;

    // Recursive backtracking bilan barcha kombinatsiyalarni sinab ko'rish
    const findCombination = (
      index: number,
      currentCombination: any[],
      currentSum: number,
    ) => {
      const difference = Math.abs(currentSum - targetSum);

      // Agar tolerance ichida bo'lsa va minTolerance dan katta bo'lsa
      if (
        difference <= maxTolerance &&
        difference >= minTolerance &&
        currentSum >= targetSum
      ) {
        if (difference < bestDifference) {
          bestDifference = difference;
          bestCombination = [...currentCombination];
        }
      }

      // Agar target summadan juda katta bo'lsa, to'xtatamiz
      if (currentSum > targetSum + maxTolerance) {
        return;
      }

      // Barcha qolgan cheklarni sinab ko'ramiz
      for (let i = index; i < sortedChecks.length; i++) {
        const check = sortedChecks[i];
        const checkSum = parseFloat(check.chek_summa);

        // Agar qo'shsak target dan oshib ketsa, kichikroq cheklarni sinab ko'ramiz
        if (currentSum + checkSum <= targetSum + maxTolerance) {
          findCombination(
            i + 1,
            [...currentCombination, check],
            currentSum + checkSum,
          );
        }
      }
    };

    findCombination(0, [], 0);

    return bestCombination;
  }

  /**
   * Chek summasiga mos faktura topish
   */
  async findMatchingFaktura(
    chekSumma: number,
    tolerance: number = 0.01,
  ): Promise<any | null> {
    const result = await this.dbManager.query(
      `
            SELECT * FROM faktura 
            WHERE is_active = true 
            AND ABS(faktura_summa - $1) <= $2
            ORDER BY ABS(faktura_summa - $1) ASC
            LIMIT 1
        `,
      [chekSumma, tolerance],
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Invoice item yaratish
   */
  async createInvoiceItem(item: InvoiceItem): Promise<void> {
    const data: SelectCheckData = {
      mxik: item.mxik,
      ulchov: item.ulchov,
      faktura_summa: item.faktura_summa,
      faktura_miqdor: item.faktura_miqdor,
      chek_raqam: item.chek_raqam,
      maxsulot_nomi: item.maxsulot_nomi,
      chek_summa: item.chek_summa,
      miqdor: item.miqdor,
      umumiy_chek_summa: item.umumiy_chek_summa,
      bir_birlik: item.bir_birlik,
    };

    await this.dbManager.insertSelectCheck(data);
    logger.info(`✅ Invoice item yaratildi: ${item.chek_raqam} - ${item.mxik}`);
  }

  /**
   * Chekni processed qilish
   */
  async markCheckAsProcessed(chekRaqam: string): Promise<void> {
    await this.dbManager.markCheckAsProcessed(chekRaqam);
    logger.info(`✅ Chek processed: ${chekRaqam}`);
  }

  /**
   * Fakturani is_active = false qilish
   */
  async deactivateFaktura(fakturaId: number): Promise<void> {
    await this.dbManager.query(
      `
            UPDATE faktura 
            SET is_active = false 
            WHERE id = $1
        `,
      [fakturaId],
    );

    logger.info(`✅ Faktura deactivated: ID ${fakturaId}`);
  }

  /**
   * select_checks dan aktiv itemlarni olish
   */
  async getActiveSelectChecks(): Promise<any[]> {
    const result = await this.dbManager.query(`
            SELECT * FROM select_checks
            WHERE is_active = true
            ORDER BY created_at ASC
        `);

    return result.rows;
  }

  /**
   * Select_check ni active qilish
   */
  async activateSelectCheck(id: number): Promise<void> {
    await this.dbManager.query(
      `
            UPDATE select_checks 
            SET is_active = true 
            WHERE id = $1
        `,
      [id],
    );

    logger.info(`✅ Select_check activated: ID ${id}`);
  }

  /**
   * Statistikani olish
   */
  async getStatistics(): Promise<any> {
    return await this.dbManager.getStatistics();
  }

  /**
   * Chek raqam bo'yicha select_checks dan topish
   */
  async getSelectChecksByChekRaqam(chekRaqam: string): Promise<any[]> {
    const result = await this.dbManager.query(
      `
            SELECT * FROM select_checks 
            WHERE chek_raqam = $1 
            ORDER BY created_at DESC
        `,
      [chekRaqam],
    );

    return result.rows;
  }

  /**
   * MXIK bo'yicha select_checks dan topish
   */
  async getSelectChecksByMxik(mxik: string): Promise<any[]> {
    const result = await this.dbManager.query(
      `
            SELECT * FROM select_checks 
            WHERE mxik = $1 
            ORDER BY created_at DESC
        `,
      [mxik],
    );

    return result.rows;
  }

  /**
   * Faktura uchun invoice yaratish (bir necha chek bilan)
   */
  async processFakturaWithMultipleChecks(fakturaId: number): Promise<void> {
    try {
      // Fakturani olish
      const fakturaResult = await this.dbManager.query(
        `
                SELECT * FROM faktura 
                WHERE id = $1 AND is_active = true 
                LIMIT 1
            `,
        [fakturaId],
      );

      if (fakturaResult.rows.length === 0) {
        throw new Error(`Faktura topilmadi: ${fakturaId}`);
      }

      const faktura = fakturaResult.rows[0];

      // Mos cheklarni topish
      const matchingChecks = await this.findMatchingChecksForFaktura(faktura);

      if (matchingChecks.length === 0) {
        throw new Error(
          `Faktura uchun mos cheklar topilmadi: ${faktura.faktura_summa}`,
        );
      }

      // Umumiy chek summasi
      const umumiyChekSumma = matchingChecks.reduce(
        (sum, check) => sum + parseFloat(check.chek_summa),
        0,
      );

      const fakturaSumma = parseFloat(faktura.faktura_summa);
      const fakturaMiqdor = parseFloat(faktura.faktura_miqdor);
      const birBirlik = fakturaSumma / fakturaMiqdor;

      // Har bir chek uchun invoice item yaratish
      const items: InvoiceItem[] = [];

      for (const check of matchingChecks) {
        const chekSumma = parseFloat(check.chek_summa);
        const miqdor = chekSumma / birBirlik;

        const item: InvoiceItem = {
          mxik: faktura.mxik,
          ulchov: faktura.ulchov,
          faktura_summa: fakturaSumma,
          faktura_miqdor: fakturaMiqdor,
          chek_raqam: check.chek_raqam,
          maxsulot_nomi: check.maxsulot_nomi,
          chek_summa: chekSumma,
          miqdor: miqdor,
          umumiy_chek_summa: umumiyChekSumma,
          bir_birlik: birBirlik,
        };

        await this.createInvoiceItem(item);
        await this.markCheckAsProcessed(check.chek_raqam);
        items.push(item);
      }

      logger.info('\n' + '='.repeat(70));
      logger.info('✅ FAKTURA PROCESSED:');
      logger.info('='.repeat(70));
      logger.info(`   Faktura ID: ${fakturaId}`);
      logger.info(`   Faktura summa: ${fakturaSumma}`);
      logger.info(`   Cheklar soni: ${matchingChecks.length}`);
      logger.info(`   Umumiy chek summa: ${umumiyChekSumma.toFixed(2)}`);
      logger.info(
        `   Farq: ${(umumiyChekSumma - fakturaSumma).toFixed(2)} (${(
          ((umumiyChekSumma - fakturaSumma) / fakturaSumma) *
          100
        ).toFixed(2)}%)`,
      );
      logger.info('='.repeat(70) + '\n');
    } catch (error) {
      logger.error(`❌ Faktura processing xatosi (${fakturaId}):`, error);
      throw error;
    }
  }

  /**
   * Simple invoice processing algoritmi
   */
  async processSimpleInvoice(chekRaqam: string): Promise<InvoiceItem[]> {
    try {
      // Chekni topish
      const checkResult = await this.dbManager.query(
        `
                SELECT * FROM checks 
                WHERE chek_raqam = $1 AND processed = false 
                LIMIT 1
            `,
        [chekRaqam],
      );

      if (checkResult.rows.length === 0) {
        throw new Error(
          `Chek topilmadi yoki allaqachon processed: ${chekRaqam}`,
        );
      }

      const check = checkResult.rows[0];
      const chekSumma = parseFloat(check.chek_summa);

      // Fakturani topish (summaga mos)
      const faktura = await this.findMatchingFaktura(chekSumma, 0.5);

      if (!faktura) {
        throw new Error(`Mos faktura topilmadi: ${chekSumma}`);
      }

      // Hisob-kitob
      const fakturaSumma = parseFloat(faktura.faktura_summa);
      const fakturaMiqdor = parseFloat(faktura.faktura_miqdor);

      const birBirlik = fakturaSumma / fakturaMiqdor;
      const miqdor = chekSumma / birBirlik;

      const item: InvoiceItem = {
        mxik: faktura.mxik,
        ulchov: faktura.ulchov,
        faktura_summa: fakturaSumma,
        faktura_miqdor: fakturaMiqdor,
        chek_raqam: chekRaqam,
        maxsulot_nomi: check.maxsulot_nomi,
        chek_summa: chekSumma,
        miqdor: miqdor,
        umumiy_chek_summa: chekSumma,
        bir_birlik: birBirlik,
      };

      // Save to database
      await this.createInvoiceItem(item);
      await this.markCheckAsProcessed(chekRaqam);

      logger.info(`✅ Invoice processed: ${chekRaqam}`);

      return [item];
    } catch (error) {
      logger.error(`❌ Invoice processing xatosi (${chekRaqam}):`, error);
      throw error;
    }
  }

  /**
   * Barcha active fakturalar uchun invoice yaratish
   */
  async processAllActiveFakturas(): Promise<void> {
    try {
      const fakturas = await this.getActiveFakturas();
      logger.info(`📋 ${fakturas.length} ta active faktura topildi`);

      let processed = 0;
      let failed = 0;

      for (const faktura of fakturas) {
        try {
          await this.processFakturaWithMultipleChecks(faktura.id);
          processed++;
        } catch (error) {
          failed++;
          logger.warning(
            `⚠️ Fakturani process qilib bo'lmadi: ${faktura.faktura_summa}`,
          );
        }
      }

      logger.info('\n' + '='.repeat(70));
      logger.info('📊 PROCESSING NATIJALARI:');
      logger.info('='.repeat(70));
      logger.info(`   ✅ Muvaffaqiyatli: ${processed}`);
      logger.info(`   ❌ Xato: ${failed}`);
      logger.info('='.repeat(70) + '\n');
    } catch (error) {
      logger.error('❌ Batch processing xatosi:', error);
      throw error;
    }
  }

  /**
   * Barcha unprocessed cheklar uchun invoice yaratish
   */
  async processAllUnprocessedChecks(): Promise<void> {
    try {
      const checks = await this.getUnprocessedChecks(100);
      logger.info(`📋 ${checks.length} ta unprocessed chek topildi`);

      let processed = 0;
      let failed = 0;

      for (const check of checks) {
        try {
          await this.processSimpleInvoice(check.chek_raqam);
          processed++;
        } catch (error) {
          failed++;
          logger.warning(
            `⚠️ Chekni process qilib bo'lmadi: ${check.chek_raqam}`,
          );
        }
      }

      logger.info('\n' + '='.repeat(70));
      logger.info('📊 PROCESSING NATIJALARI:');
      logger.info('='.repeat(70));
      logger.info(`   ✅ Muvaffaqiyatli: ${processed}`);
      logger.info(`   ❌ Xato: ${failed}`);
      logger.info('='.repeat(70) + '\n');
    } catch (error) {
      logger.error('❌ Batch processing xatosi:', error);
      throw error;
    }
  }
}

export default IncomingMessage;
