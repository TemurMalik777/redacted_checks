// src/services/excelImportService.ts

import { readExcel } from '../excel/excelReader';
import { DbManager } from '../database/checkImporter';
import { FakturaProcessor } from '../excel/fakturaProcessor';
import { Import } from '../modules/index';
import { logger } from '../automation/utils/logUtils';

export class ExcelImportService {
  private dbManager: DbManager;

  constructor() {
    this.dbManager = new DbManager();
  }

  /**
   * Excel faylni to'liq import qilish
   */
  async importExcelFile(
    filePath: string,
    userId: number
  ): Promise<{
    importId: number;
    checksCount: number;
    fakturasCount: number;
    selectChecksCount: number;
  }> {
    // 1️⃣ Import record yaratish
    const importRecord = await Import.create({
      fileName: filePath.split('/').pop() || 'unknown.xlsx',
      source: 'excel',
      totalRows: 0,
      importedBy: userId,
      status: 'processing',
      startedAt: new Date(),
    });

    try {
      // 2️⃣ Excel o'qish
      logger.info(`📂 Excel o'qilmoqda: ${filePath}`);
      const { checks, fakturas } = readExcel(filePath);

      await importRecord.update({
        totalRows: checks.length + fakturas.length,
      });

      // 3️⃣ Database ga ulanish
      await this.dbManager.connect();

      // 4️⃣ Checks import
      logger.info(`📦 ${checks.length} ta chek import qilinmoqda...`);
      const checksImported = await this.dbManager.insertChecks(
        checks.map(c => ({
          creation_data_check: new Date().toISOString(),
          chek_raqam: c.chek_raqam,
          chek_summa: c.chek_summa,
          maxsulot_nomi: c.maxsulot_nomi,
        }))
      );

      // 5️⃣ Fakturalar import
      logger.info(`📋 ${fakturas.length} ta faktura import qilinmoqda...`);
      const fakturasImported = await this.dbManager.insertFakturas(
        fakturas.map(f => ({
          creation_data_faktura: new Date().toISOString(),
          mxik: f.mxik,
          ulchov: f.ulchov,
          faktura_summa: f.faktura_summa,
          faktura_miqdor: f.faktura_miqdor,
        }))
      );

      // 6️⃣ Select_checks yaratish (FakturaProcessor)
      logger.info('⚙️ Select_checks yaratilmoqda...');
      const processor = new FakturaProcessor();
      await processor.connect();
      const results = await processor.processAllFakturas();
      await processor.disconnect();

      await this.dbManager.disconnect();

      // 7️⃣ Import yakunlash
      await importRecord.update({
        status: 'completed',
        importedRows: checksImported + fakturasImported,
        failedRows: (checks.length + fakturas.length) - (checksImported + fakturasImported),
        finishedAt: new Date(),
      });

      logger.info('✅ Import muvaffaqiyatli yakunlandi!');

      return {
        importId: importRecord.id,
        checksCount: checksImported,
        fakturasCount: fakturasImported,
        selectChecksCount: results.length,
      };

    } catch (error) {
      await importRecord.update({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        finishedAt: new Date(),
      });

      if (this.dbManager) {
        await this.dbManager.disconnect();
      }

      throw error;
    }
  }
}