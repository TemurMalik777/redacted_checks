import { DbManager, SelectCheckData } from './dbManager';
import { logger } from '../automation/utils/logUtils';

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
   * Select_checks dan aktiv itemlarni olish
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
