import { FakturaProcessor } from './fakturaProcessor';
import { logger } from '../automation/utils/logUtils';
import { DbManager } from '../database/checkImporter';

export interface SelectCheckResult {
  id: number;
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
 * Checks va Faktura tableleridan select_checks yaratish
 * 
 * Jarayon:
 * 1. Checks va Faktura tableleridan ma'lumot olish
 * 2. FakturaProcessor orqali hisob-kitob qilish
 * 3. Natijalarni select_checks tableiga yozish
 * 4. Select_checks tabledan qaytarish
 * 
 * ⚠️ Bu funksiya chaqirilishidan OLDIN Excel import qilingan bo'lishi kerak!
 */
export async function processChecksToSelectChecks(): Promise<SelectCheckResult[]> {
  try {
    logger.info('\n' + '='.repeat(80));
    logger.info('🔄 CHECKS VA FAKTURA TABLELARDAN SELECT_CHECKS YARATISH');
    logger.info('='.repeat(80) + '\n');

    // 1️⃣ FAKTURA PROCESSOR YARATISH
    logger.info('📊 1. FakturaProcessor yaratilmoqda...');
    const processor = new FakturaProcessor();
    await processor.connect();
    logger.info('✅ FakturaProcessor yaratildi\n');

    // 2️⃣ STATISTIKA (Boshlang'ich holat)
    logger.info('📈 2. Dastlabki statistika:');
    // Bu yerda kerak bo'lsa statistika chiqarish mumkin
    logger.info('');

    // 3️⃣ SELECT_CHECKS YARATISH (Avtomatik hisob-kitob)
    logger.info('⚙️ 3. Hisob-kitob va select_checks yaratish boshlandi...\n');

    const results = await processor.processAllFakturas();

    if (results.length === 0) {
      logger.warning('❌ Hech qanday select_checks yaratilmadi!');
      await processor.disconnect();
      return [];
    }

    logger.info(`\n✅ ${results.length} ta select_checks muvaffaqiyatli yaratildi!`);

    // 4️⃣ SELECT_CHECKS TABLEDAN MA'LUMOT OLISH
    logger.info('\n📋 4. Select_checks tabledan olingan ma\'lumotlar:\n');
    const selectChecksResults = await getSelectChecksResults(processor);

    // 5️⃣ NATIJALARNI CHOP ETISH
    await printSelectChecksResults(selectChecksResults);

    await processor.disconnect();
    logger.info('\n✅ Barcha operatsiyalar muvaffaqiyatli yakunlandi!');

    return selectChecksResults;
  } catch (error) {
    logger.error(`\n❌ KRITIK XATO:`, error);
    return [];
  }
}

/**
 * Select_checks tabledan natijalarni olish
 */
async function getSelectChecksResults(processor: FakturaProcessor): Promise<SelectCheckResult[]> {
  const dbManager = (processor as any).dbManager as DbManager;
  
  const result = await dbManager.query(`
    SELECT * FROM select_checks 
    ORDER BY id
  `);

  return result.rows as SelectCheckResult[];
}

/**
 * Natijalarni chiroyli ko'rsatish
 */
async function printSelectChecksResults(rows: SelectCheckResult[]): Promise<void> {
  if (rows.length === 0) {
    logger.warning('❌ Select_checks tabledan ma\'lumot topilmadi');
    return;
  }

  logger.info('\n' + '='.repeat(150));
  logger.info(
    `${'ID'.padEnd(5)} ${'Chek №'.padEnd(15)} ${'MXIK'.padEnd(12)} ${'Ulchov'.padEnd(10)} ${'Maxsulot'.padEnd(25)} ${'Chek summa'.padStart(12)} ${'Miqdor'.padStart(10)} ${'Bir birlik'.padStart(12)} ${'Umumiy'.padStart(12)} ${'Active'.padEnd(8)}`
  );
  logger.info('='.repeat(150));

  for (const r of rows) {
    const maxsulot = (r.maxsulot_nomi?.substring(0, 23) || '-').padEnd(25);
    const isActive = r.is_active ? 'Yes' : 'No';

    logger.info(
      `${String(r.id).padEnd(5)} ${r.chek_raqam.padEnd(15)} ${r.mxik.padEnd(12)} ${r.ulchov.padEnd(10)} ${maxsulot} ${r.chek_summa.toFixed(2).padStart(12)} ${r.miqdor.toFixed(2).padStart(10)} ${r.bir_birlik.toFixed(2).padStart(12)} ${r.umumiy_chek_summa.toFixed(2).padStart(12)} ${isActive.padEnd(8)}`
    );
  }

  logger.info('='.repeat(150));
  logger.info(`✅ Jami: ${rows.length} ta yozuv\n`);
}

/**
 * Reset funksiyasi - tashqaridan chaqirish uchun
 */
export async function resetAllData(): Promise<void> {
  const processor = new FakturaProcessor();
  await processor.connect();
  await processor.resetAll();
  await processor.disconnect();
}

/**
 * Statistikani ko'rsatish
 */
export async function showStatistics(): Promise<void> {
  const dbManager = new DbManager();
  await dbManager.connect();

  const stats = await dbManager.getStatistics();

  logger.info('\n' + '='.repeat(70));
  logger.info('📊 STATISTIKA');
  logger.info('='.repeat(70));
  logger.info(`Jami cheklar: ${stats.total_checks}`);
  logger.info(`Processed=false cheklar: ${stats.unprocessed_checks}`);
  logger.info(`Processed=true cheklar: ${stats.processed_checks}`);
  logger.info(`Jami fakturalar: ${stats.total_fakturas}`);
  logger.info(`Aktiv fakturalar: ${stats.active_fakturas}`);
  logger.info(`Noaktiv fakturalar: ${stats.inactive_fakturas}`);
  logger.info(`Select_checks'da: ${stats.total_select_checks}`);
  logger.info(`Processed=false cheklar summasi: ${stats.total_unprocessed_summa || 0}`);
  logger.info(`Processed=true cheklar summasi: ${stats.total_processed_summa || 0}`);
  logger.info(`Select_checks umumiy summa: ${stats.total_selected_summa || 0}`);
  logger.info('='.repeat(70) + '\n');

  await dbManager.disconnect();
}