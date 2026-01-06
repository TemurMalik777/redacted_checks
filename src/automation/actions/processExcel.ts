import { Page } from 'playwright';
import { logger } from '../utils/logUtils';
import { CheckData, fillEditCheckFields } from './fieldFiller';
import { performSearchAndOpenDetail } from './searchDetail';
import { clickEditButton } from './editButton';

/**
 * Process Excel UI Service
 * Select_checks tabledan olingan ma'lumotlarni UI orqali to'ldirish
 * 
 * Bu eng muhim orchestrator - barcha actionlarni birlashtiradi:
 * 1. Login kutish
 * 2. Fiskal modul kutish
 * 3. Har bir chekni qidirish
 * 4. Tahrirlash oynasini ochish
 * 5. Ma'lumotlarni to'ldirish
 * 6. CAPTCHA yechish
 * 7. Saqlash
 */
export class ProcessExcelUIService {
  constructor(
    private page: Page,
    private captchaApiKey: string
  ) {}

  /**
   * Asosiy jarayon - barcha cheklarni qayta ishlash
   * 
   * @param selectChecksData - Database'dan olingan cheklar ro'yxati
   * @returns Natija statistikasi
   */
  async execute(selectChecksData: CheckData[]): Promise<{
    success: number;
    failed: number;
    total: number;
  }> {
    logger.info('\n' + '='.repeat(80));
    logger.info('📝 CHEKLAR QAYTA ISHLASH BOSHLANDI');
    logger.info('='.repeat(80) + '\n');

    if (!selectChecksData || selectChecksData.length === 0) {
      logger.warn('⚠️ Qayta ishlanadigan cheklar yo\'q');
      return { success: 0, failed: 0, total: 0 };
    }

    logger.info(`📊 ${selectChecksData.length} ta chek UI orqali qayta ishlanadi\n`);

    let successCount = 0;
    let errorCount = 0;

    // Har bir chekni ketma-ket qayta ishlash
    for (let idx = 0; idx < selectChecksData.length; idx++) {
      const row = selectChecksData[idx];

      try {
        const chekRaqam = row.chek_raqam ? String(row.chek_raqam).trim() : '';

        if (!chekRaqam) {
          logger.warn(`⚠️ ${idx + 1}. Chek raqami bo'sh, o'tkazib yuborildi`);
          errorCount++;
          continue;
        }

        // Chek ma'lumotlarini log qilish
        logger.info(`\n${'='.repeat(60)}`);
        logger.info(`🔹 ${idx + 1}/${selectChecksData.length} - CHEK: ${chekRaqam}`);
        logger.info(`${'='.repeat(60)}`);
        logger.info(`   📦 MXIK: ${row.mxik || 'N/A'}`);
        logger.info(`   📏 Ulchov: ${row.ulchov || row.unit || 'N/A'}`);
        logger.info(`   💰 Faktura summa: ${row.amount || 'N/A'}`);
        logger.info(`   🔢 Miqdor: ${row.miqdor || row.amount || 'N/A'}`);
        logger.info(`   💵 Bir birlik: ${row.bir_birlik || 'N/A'}`);

        // 1️⃣ QIDIRISH - Chekni qidirish va "Batafsil" ochish
        logger.info(`\n   🔍 Chek qidirilmoqda...`);
        const searchSuccess = await performSearchAndOpenDetail(this.page, chekRaqam, 2);

        if (!searchSuccess) {
          logger.error(`   ❌ Chek topilmadi yoki ochilmadi`);
          errorCount++;
          continue;
        }

        logger.info(`   ✅ Chek topildi va ochildi`);

        // 2️⃣ TAHRIRLASH - Modal oynani ochish
        logger.info(`   ✏️ Tahrirlash tugmasi bosilmoqda...`);
        const editSuccess = await clickEditButton(this.page, 3);

        if (!editSuccess) {
          logger.warn(`   ⚠️ Tahrirlash oynasi ochilmadi`);
          errorCount++;
          continue;
        }

        logger.info(`   ✅ Tahrirlash oynasi ochildi`);

        // 3️⃣ TO'LDIRISH - Forma to'ldirish, CAPTCHA, saqlash
        logger.info(`   📝 Ma'lumotlar to'ldirilmoqda...`);
        const fillSuccess = await fillEditCheckFields(this.page, row, this.captchaApiKey);

        if (fillSuccess) {
          logger.info(`   ✅ Chek muvaffaqiyatli saqlandi!`);
          successCount++;
        } else {
          logger.error(`   ❌ Chek saqlanmadi`);
          errorCount++;
        }

        // Keyingi chek uchun qisqa kutish
        await this.page.waitForTimeout(1000);
      } catch (error) {
        logger.error(`   ❌ Chek qayta ishlashda xato:`, error);
        errorCount++;
      }
    }

    // Yakuniy natija
    logger.info('\n' + '='.repeat(80));
    logger.info('🏁 JARAYON YAKUNLANDI');
    logger.info('='.repeat(80));
    logger.info(`✅ Muvaffaqiyatli: ${successCount} ta`);
    logger.info(`❌ Xatolar: ${errorCount} ta`);
    logger.info(`📊 Jami: ${selectChecksData.length} ta`);
    logger.info('='.repeat(80) + '\n');

    return {
      success: successCount,
      failed: errorCount,
      total: selectChecksData.length,
    };
  }

  /**
   * Bitta chekni qayta ishlash
   * 
   * @param chekData - Bitta chekning ma'lumotlari
   * @returns Muvaffaqiyatli bo'lsa true
   */
  async processSingleCheck(chekData: CheckData): Promise<boolean> {
    try {
      const chekRaqam = chekData.chek_raqam ? String(chekData.chek_raqam).trim() : '';

      if (!chekRaqam) {
        logger.error('❌ Chek raqami bo\'sh');
        return false;
      }

      logger.info('\n' + '='.repeat(60));
      logger.info(`📝 BITTA CHEK QAYTA ISHLASH - ${chekRaqam}`);
      logger.info('='.repeat(60) + '\n');

      // 1. Qidirish
      logger.info('🔍 Chek qidirilmoqda...');
      const searchSuccess = await performSearchAndOpenDetail(this.page, chekRaqam);

      if (!searchSuccess) {
        logger.error('❌ Chek topilmadi');
        return false;
      }

      // 2. Tahrirlash
      logger.info('✏️ Tahrirlash oynasi ochilmoqda...');
      const editSuccess = await clickEditButton(this.page);

      if (!editSuccess) {
        logger.error('❌ Tahrirlash oynasi ochilmadi');
        return false;
      }

      // 3. To'ldirish
      logger.info('📝 Ma\'lumotlar to\'ldirilmoqda...');
      const fillSuccess = await fillEditCheckFields(this.page, chekData, this.captchaApiKey);

      if (fillSuccess) {
        logger.info('\n✅✅✅ CHEK MUVAFFAQIYATLI QAYTA ISHLANDI! ✅✅✅\n');
        return true;
      } else {
        logger.error('\n❌ Chek qayta ishlanmadi\n');
        return false;
      }
    } catch (error) {
      logger.error('❌ Bitta chek qayta ishlashda xato:', error);
      return false;
    }
  }

  /**
   * Fiskal modul yuklanishini kutish
   * 
   * Sahifa to'liq yuklanib, fiskal modul render bo'lishini kutadi
   * 
   * @param timeout - Maksimal kutish vaqti (default: 30 sekund)
   * @returns true qaytaradi
   */
  async waitForFiskalModule(timeout: number = 30000): Promise<boolean> {
    try {
      logger.info('⏳ Fiskal modul yuklanishi kutilmoqda...');

      // Fiskal modul elementi paydo bo'lishini kutish
      await this.page.waitForSelector('.ant-select-selection-item', { timeout });

      logger.info('🟢 Fiskal modul render bo\'ldi, 10 sekund kutiladi...');
      
      // Qo'shimcha stabilizatsiya uchun kutish
      await this.page.waitForTimeout(10000);

      logger.info('⏳ 10 sekund kutildi, jarayon davom etadi');
      return true;
    } catch (error) {
      logger.warn('⚠️ Fiskal modul element topilmadi, 10 sekund kutiladi baribir...');
      
      // Xato bo'lsa ham kutish
      await this.page.waitForTimeout(10000);
      return true;
    }
  }

  /**
   * Login holatini tekshirish
   * 
   * Dashboard elementi mavjudligini tekshirib, foydalanuvchi 
   * tizimga kirganligini aniqlaydi
   * 
   * @returns Login qilgan bo'lsa true
   */
  async checkLoginStatus(): Promise<boolean> {
    try {
      // Dashboard selectorlari
      const dashboardSelectors = [
        '.dashboard-container',
        '.ant-layout-content',
        'div[class*="dashboard"]',
        'main',
      ];

      // Dashboard elementi borligini tekshirish
      for (const selector of dashboardSelectors) {
        try {
          const element = this.page.locator(selector).first();
          const count = await element.count();

          if (count > 0) {
            const isVisible = await element.isVisible({ timeout: 2000 });
            if (isVisible) {
              logger.info('✅ Foydalanuvchi tizimga kirgan');
              return true;
            }
          }
        } catch {
          continue;
        }
      }

      // Login sahifasi mavjudligini tekshirish
      const loginSelectors = ['input[name="tin"]', 'input[name="password"]', '.login-form'];

      for (const selector of loginSelectors) {
        try {
          const element = this.page.locator(selector).first();
          const count = await element.count();

          if (count > 0) {
            const isVisible = await element.isVisible({ timeout: 2000 });
            if (isVisible) {
              logger.warn('⚠️ Foydalanuvchi hali tizimga kirmagan (login sahifasi)');
              return false;
            }
          }
        } catch {
          continue;
        }
      }

      logger.warn('⚠️ Login holati noma\'lum');
      return false;
    } catch (error) {
      logger.error('❌ Login holatini tekshirishda xato:', error);
      return false;
    }
  }

  /**
   * Login kutish (polling)
   * 
   * Foydalanuvchi tizimga kirguncha kutadi (maksimal 5 daqiqa)
   * Har 2 sekundda login holatini tekshiradi
   * 
   * @param timeout - Maksimal kutish vaqti (default: 5 daqiqa)
   * @returns Login muvaffaqiyatli bo'lsa true
   */
  async waitForLogin(timeout: number = 300000): Promise<boolean> {
    logger.info('🔐 Foydalanuvchi tizimga kirishi kutilmoqda...');

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const isLoggedIn = await this.checkLoginStatus();

      if (isLoggedIn) {
        logger.info('✅ Foydalanuvchi tizimga kirdi\n');
        return true;
      }

      // Har 2 sekundda tekshirish
      await this.page.waitForTimeout(2000);
    }

    logger.error('❌ Tizimga kirish amalga oshmadi (timeout)');
    return false;
  }
}

/**
 * To'liq jarayon - brauzerdan database gacha
 * 
 * Bu funksiya taxSiteService bilan integratsiya qilinadi
 * 
 * Workflow:
 * 1. Login kutish (5 daqiqa timeout)
 * 2. Fiskal modul yuklanishini kutish (10 sekund)
 * 3. Har bir chekni ketma-ket qayta ishlash:
 *    - Qidirish
 *    - Tahrirlash
 *    - To'ldirish
 *    - CAPTCHA yechish
 *    - Saqlash
 * 
 * @param page - Playwright Page obyekti
 * @param selectChecksData - Database'dan olingan cheklar
 * @param captchaApiKey - 2Captcha API key
 * @returns Natija statistikasi
 */
export async function processExcelUI(
  page: Page,
  selectChecksData: CheckData[],
  captchaApiKey: string
): Promise<{ success: number; failed: number; total: number }> {
  const service = new ProcessExcelUIService(page, captchaApiKey);
  
  logger.info('\n' + '='.repeat(80));
  logger.info('🌐 EXCEL QAYTA ISHLASH JARAYONI');
  logger.info('='.repeat(80) + '\n');

  // 1️⃣ LOGIN KUTISH
  logger.info('1️⃣ Login jarayoni...');
  const loginSuccess = await service.waitForLogin();
  
  if (!loginSuccess) {
    logger.error('❌ Login amalga oshmadi');
    return { 
      success: 0, 
      failed: selectChecksData.length, 
      total: selectChecksData.length 
    };
  }

  // 2️⃣ FISKAL MODUL KUTISH
  logger.info('2️⃣ Fiskal modul yuklanishi...');
  await service.waitForFiskalModule();

  // 3️⃣ CHEKLAR QAYTA ISHLASH
  logger.info('3️⃣ Cheklar qayta ishlash boshlandi...\n');
  const result = await service.execute(selectChecksData);

  return result;
}

/**
 * Bitta chekni qayta ishlash (tez funksiya)
 * 
 * Test yoki individual chek qayta ishlash uchun
 * 
 * @param page - Playwright Page obyekti
 * @param chekData - Bitta chekning ma'lumotlari
 * @param captchaApiKey - 2Captcha API key
 * @returns Muvaffaqiyatli bo'lsa true
 */
export async function processSingleCheck(
  page: Page,
  chekData: CheckData,
  captchaApiKey: string
): Promise<boolean> {
  const service = new ProcessExcelUIService(page, captchaApiKey);
  return service.processSingleCheck(chekData);
}