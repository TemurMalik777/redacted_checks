import { DbManager } from '../database/checkImporter';
import { logger } from '../automation/utils/logUtils';

interface CheckRecord {
  chek_raqam: string;
  chek_summa: number;
  maxsulot_nomi?: string;
}

interface FakturaRecord {
  id: number;
  mxik: string;
  ulchov: string;
  faktura_summa: number;
  faktura_miqdor: number;
  is_active: boolean;
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

export class FakturaProcessor {
  private dbManager: DbManager;

  constructor() {
    this.dbManager = new DbManager();
  }

  async connect(): Promise<void> {
    await this.dbManager.connect();
  }

  async disconnect(): Promise<void> {
    await this.dbManager.disconnect();
  }

  /**
   * Aktiv fakturalarni olish (katta summadan boshlab)
   */
  async getActiveFakturas(): Promise<FakturaRecord[]> {
    const result = await this.dbManager.query(`
      SELECT id, mxik, ulchov, faktura_summa, faktura_miqdor, is_active
      FROM faktura
      WHERE is_active = true
      ORDER BY faktura_summa DESC
    `);

    return result.rows as FakturaRecord[];
  }

  /**
   * Processed=false cheklarni olish
   */
  async getUnprocessedChecks(
    limitSumma?: number,
  ): Promise<CheckRecord[]> {
    let query = `
      SELECT chek_raqam, chek_summa, maxsulot_nomi
      FROM checks
      WHERE processed = false
    `;

    const params: any[] = [];

    if (limitSumma !== undefined) {
      query += ` AND chek_summa <= $1`;
      params.push(limitSumma);
    }

    query += ` ORDER BY chek_summa DESC`;

    const result = await this.dbManager.query(query, params);
    return result.rows as CheckRecord[];
  }

  /**
   * Eng optimal cheklar kombinatsiyasini topish
   * QOIDALAR:
   * - Cheklar summasi faktura summasidan KAM bo'lmasligi kerak
   * - Teng yoki 1% dan 4% gacha ortiq bo'lishi mumkin
   */
  findBestChecksCombination(
    targetSumma: number,
    maxSumma: number,
    availableChecks: CheckRecord[],
  ): { checks: CheckRecord[]; totalSumma: number } {
    // 1. Bitta katta chek topish
    for (const check of availableChecks) {
      const checkSumma = check.chek_summa;
      if (checkSumma >= targetSumma && checkSumma <= maxSumma) {
        return { checks: [check], totalSumma: checkSumma };
      }
    }

    // 2. Kichikroq cheklarni kombinatsiyalash
    const selectedChecks: CheckRecord[] = [];
    let totalSumma = 0;

    for (const check of availableChecks) {
      const checkSumma = check.chek_summa;

      if (totalSumma + checkSumma <= maxSumma) {
        selectedChecks.push(check);
        totalSumma += checkSumma;

        // Maqsadga yetdik
        if (totalSumma >= targetSumma) {
          return { checks: selectedChecks, totalSumma };
        }
      }
    }

    // Agar summa kam bo'lsa, bo'sh qaytaramiz
    if (totalSumma >= targetSumma) {
      return { checks: selectedChecks, totalSumma };
    }

    return { checks: [], totalSumma: 0 };
  }

  /**
   * Bitta faktura uchun processing
   */
  async processFakturaItem(faktura: FakturaRecord): Promise<ProcessResult[]> {
    try {
      const fakturaId = faktura.id;
      const mxik = faktura.mxik;
      const ulchov = faktura.ulchov;
      const fakturaSumma = faktura.faktura_summa;
      const fakturaMiqdor = faktura.faktura_miqdor;

      const maxSumma = fakturaSumma * 1.04; // 4% tolerance

      logger.info(`   📋 Faktura: MXIK=${mxik}, Ulchov=${ulchov}`);
      logger.info(
        `      Target: ${fakturaSumma.toFixed(2)}, Max: ${maxSumma.toFixed(2)}`,
      );

      const allChecks = await this.getUnprocessedChecks(maxSumma);

      if (allChecks.length === 0) {
        logger.warning(`      ⚠️ Mos cheklar topilmadi`);
        return [];
      }

      const { checks: selectedChecks, totalSumma } =
        this.findBestChecksCombination(fakturaSumma, maxSumma, allChecks);

      if (selectedChecks.length === 0) {
        logger.warning(`      ⚠️ Optimal kombinatsiya topilmadi`);
        return [];
      }

      if (totalSumma < fakturaSumma) {
        logger.warning(`      ❌ Cheklar summasi kam!`);
        return [];
      }

      if (totalSumma > fakturaSumma) {
        const percentDiff =
          ((totalSumma - fakturaSumma) / fakturaSumma) * 100;
        if (percentDiff > 4) {
          logger.warning(
            `      ❌ Cheklar summasi ${percentDiff.toFixed(2)}% ortiq`,
          );
          return [];
        }
        logger.info(
          `      ✅ ${selectedChecks.length} ta chek, summa: ${totalSumma.toFixed(2)} (+${percentDiff.toFixed(2)}%)`,
        );
      } else {
        logger.info(
          `      ✅ ${selectedChecks.length} ta chek, summa: ${totalSumma.toFixed(2)}`,
        );
      }

      // Bir birlik narx
      const birBirlik = Number((totalSumma / fakturaMiqdor).toFixed(2));

      // Miqdorlarni hisoblash
      const checkMiqdorlar: {
        check: CheckRecord;
        checkSumma: number;
        miqdor: number;
      }[] = [];
      let totalMiqdorUsed = 0;

      for (const check of selectedChecks) {
        const checkSumma = check.chek_summa;
        const ulush = checkSumma / totalSumma;
        let miqdor = fakturaMiqdor * ulush;

        // 6 raqamgacha round down
        miqdor = Math.floor(miqdor * 1000000) / 1000000;

        checkMiqdorlar.push({
          check,
          checkSumma,
          miqdor,
        });

        totalMiqdorUsed += miqdor;
      }

      const difference = fakturaMiqdor - totalMiqdorUsed;

      logger.info(`      📊 Jami miqdor: ${totalMiqdorUsed.toFixed(6)}`);
      logger.info(`      📊 Kerak: ${fakturaMiqdor.toFixed(6)}`);
      logger.info(`      📊 Farq: ${difference.toFixed(6)}`);

      // Farqni eng katta chekga qo'shish
      if (difference > 0) {
        let maxIndex = 0;
        let maxSumma = checkMiqdorlar[0].checkSumma;

        for (let i = 1; i < checkMiqdorlar.length; i++) {
          if (checkMiqdorlar[i].checkSumma > maxSumma) {
            maxSumma = checkMiqdorlar[i].checkSumma;
            maxIndex = i;
          }
        }

        checkMiqdorlar[maxIndex].miqdor += difference;
        logger.info(
          `      ⚙️ Farq eng katta chekga qo'shildi: ${checkMiqdorlar[maxIndex].check.chek_raqam}`,
        );
      } else if (difference < 0) {
        logger.warning(
          `      ⚠️ Ortiqcha miqdor: ${Math.abs(difference).toFixed(6)} - bu xato!`,
        );
      }

      // Database ga yozish
      const results: ProcessResult[] = [];

      for (const item of checkMiqdorlar) {
        const result: ProcessResult = {
          faktura_id: fakturaId,
          mxik,
          ulchov,
          faktura_summa: fakturaSumma,
          faktura_miqdor: fakturaMiqdor,
          chek_raqam: item.check.chek_raqam,
          maxsulot_nomi: item.check.maxsulot_nomi,
          chek_summa: item.checkSumma,
          miqdor: item.miqdor,
          umumiy_chek_summa: totalSumma,
          bir_birlik: birBirlik,
          is_active: false,
        };

        results.push(result);

        // Insert into select_checks
        await this.dbManager.query(
          `
          INSERT INTO select_checks (
            mxik, ulchov, faktura_summa, faktura_miqdor,
            chek_raqam, maxsulot_nomi, chek_summa, miqdor,
            umumiy_chek_summa, bir_birlik, is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
          [
            result.mxik,
            result.ulchov,
            result.faktura_summa,
            result.faktura_miqdor,
            result.chek_raqam,
            result.maxsulot_nomi,
            result.chek_summa,
            result.miqdor,
            result.umumiy_chek_summa,
            result.bir_birlik,
            result.is_active,
          ],
        );

        // Mark check as processed
        await this.dbManager.query(
          `UPDATE checks SET processed = true WHERE chek_raqam = $1`,
          [item.check.chek_raqam],
        );

        logger.info(
          `         • Chek ${item.check.chek_raqam}: ${item.checkSumma.toFixed(2)} sum, ${item.miqdor.toFixed(6)} miqdor`,
        );
      }

      return results;
    } catch (error) {
      logger.error(`❌ processFakturaItem xatosi:`, error);
      throw error;
    }
  }

  /**
   * Barcha aktiv fakturalarni qayta ishlash
   */
  async processAllFakturas(): Promise<ProcessResult[]> {
    logger.info('\n' + '='.repeat(70));
    logger.info('🔄 OPTIMALLASHTIRILGAN FAKTURA QAYTA ISHLASH');
    logger.info('='.repeat(70) + '\n');

    const allResults: ProcessResult[] = [];
    const maxAttempts = 3;
    const failedFakturas: Map<number, number> = new Map();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      logger.info(`\n🔁 Urinish #${attempt}/${maxAttempts}`);
      logger.info('-'.repeat(70));

      const fakturaItems = await this.getActiveFakturas();

      if (fakturaItems.length === 0) {
        logger.info(`✅ ${attempt}-urinishda aktiv faktura topilmadi`);
        break;
      }

      logger.info(`📋 ${fakturaItems.length} ta aktiv faktura topildi\n`);

      let processedCount = 0;

      for (let idx = 0; idx < fakturaItems.length; idx++) {
        const item = fakturaItems[idx];
        const { mxik, ulchov, id: fakturaId, faktura_summa } = item;

        logger.info(
          `${idx + 1}. MXIK: ${mxik} | Ulchov: ${ulchov} | Summa: ${faktura_summa.toLocaleString()}`,
        );

        const results = await this.processFakturaItem(item);

        if (results.length > 0) {
          allResults.push(...results);
          processedCount += results.length;
          logger.info(`   ✅ ${results.length} ta chek qayta ishlandi`);

          // Deactivate faktura
          await this.dbManager.query(
            `UPDATE faktura SET is_active = false WHERE id = $1`,
            [fakturaId],
          );

          failedFakturas.delete(fakturaId);
        } else {
          logger.warning(`   ⚠️ Bu faktura uchun mos chek topilmadi`);
          failedFakturas.set(fakturaId, (failedFakturas.get(fakturaId) || 0) + 1);
        }
        logger.info('');
      }

      logger.info(`📊 ${attempt}-urinish yakunlandi:`);
      logger.info(`   ✅ ${processedCount} ta chek qayta ishlandi`);
      logger.info(`   💾 Jami: ${allResults.length} ta chek\n`);
    }

    // Qayta ishlanmagan fakturalarni deactivate qilish
    if (failedFakturas.size > 0) {
      logger.info('\n' + '='.repeat(70));
      logger.info('🔄 QAYTA ISHLANMAGAN FAKTURALAR → is_active=false');
      logger.info('='.repeat(70));

      for (const [fakturaId, attempts] of failedFakturas.entries()) {
        if (attempts >= maxAttempts) {
          await this.dbManager.query(
            `UPDATE faktura SET is_active = false WHERE id = $1`,
            [fakturaId],
          );

          const info = await this.dbManager.query(
            `SELECT mxik, ulchov, faktura_summa FROM faktura WHERE id = $1`,
            [fakturaId],
          );

          if (info.rows.length > 0) {
            const { mxik, ulchov, faktura_summa } = info.rows[0];
            logger.info(
              `   ⛔ ${mxik} | ${ulchov} | ${faktura_summa.toLocaleString()} → is_active=false`,
            );
          }
        }
      }

      logger.info('\n✅ Qayta ishlanmagan fakturalar is_active=false qilindi');
    }

    await this.printFinalReport();

    return allResults;
  }

  /**
   * Yakuniy hisobot
   */
  async printFinalReport(): Promise<void> {
    logger.info('\n' + '='.repeat(70));
    logger.info('📈 YAKUNIY NATIJA');
    logger.info('='.repeat(70));

    const remaining = await this.dbManager.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(chek_summa), 0) as summa
      FROM checks 
      WHERE processed = false
    `);

    const remainingFakturas = await this.dbManager.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(faktura_summa), 0) as summa
      FROM faktura 
      WHERE is_active = true
    `);

    const processed = await this.dbManager.query(`
      SELECT COUNT(*) as count
      FROM select_checks
    `);

    logger.info(`✅ Jami qayta ishlangan: ${processed.rows[0].count} ta chek`);
    logger.info(
      `⚠️ Qolgan processed=false: ${remaining.rows[0].count} ta chek (${Number(remaining.rows[0].summa).toLocaleString()} sum)`,
    );
    logger.info(
      `⚠️ Qolgan aktiv fakturalar: ${remainingFakturas.rows[0].count} ta (${Number(remainingFakturas.rows[0].summa).toLocaleString()} sum)`,
    );

    if (remaining.rows[0].count > 0) {
      logger.info(
        `\n💡 MASLAHAT: ${remaining.rows[0].count} ta chek uchun mos faktura topilmadi`,
      );
      logger.info('   Sabablari:');
      logger.info('   - Faktura summasidan kam chek summasi');
      logger.info('   - Chek summasi 4% dan ortiq bo\'lishi');
      logger.info('   - Excel\'da faktura ma\'lumotlari yo\'qligi');
    }

    logger.info('='.repeat(70) + '\n');
  }

  /**
   * Reset qilish
   */
  async resetAll(): Promise<void> {
    logger.info('\n⚠️ RESET JARAYONI BOSHLANDI...');

    const deleted = await this.dbManager.query('DELETE FROM select_checks');
    logger.info(
      `   🗑️ ${deleted.rowCount} ta yozuv select_checks tabledan o'chirildi`,
    );

    const updatedChecks = await this.dbManager.query(
      'UPDATE checks SET processed = false',
    );
    logger.info(
      `   ♻️ ${updatedChecks.rowCount} ta chek processed=false qilindi`,
    );

    const updatedFakturas = await this.dbManager.query(
      'UPDATE faktura SET is_active = true',
    );
    logger.info(
      `   ♻️ ${updatedFakturas.rowCount} ta faktura is_active=true qilindi`,
    );

    logger.info('✅ Reset muvaffaqiyatli yakunlandi\n');
  }
}