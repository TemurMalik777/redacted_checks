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
 * 2. Онлайн касса хизматига ўтиш
 * 3. Fiskal modul kutish
 * 4. Har bir chekni qidirish
 * 5. Tahrirlash oynasini ochish
 * 6. Ma'lumotlarni to'ldirish
 * 7. CAPTCHA yechish
 * 8. Saqlash
 */
export class ProcessExcelUIService {
  constructor(private page: Page, private captchaApiKey: string) {}

  /**
   * Xizmatlar sahifasiga o'tish va kerakli xizmatni tanlash
   *
   * Login bo'lgandan keyin:
   * 1. "Xizmatlar" menyusiga bosish
   * 2. "Шахсий маълумотлар" bo'limini ochish (agar yopiq bo'lsa)
   * 3. "Онлайн назорат касса техникаси" kartasiga bosish
   *
   * @returns Muvaffaqiyatli bo'lsa true
   */
  async navigateToOnlineCashboxService(): Promise<boolean> {
    try {
      logger.info('🔄 Онлайн касса хизматига ўтилмоқда...');

      const currentUrl = this.page.url();

      // Agar allaqachon checks-info sahifasida bo'lsa
      if (currentUrl.includes('checks-info') || currentUrl.includes('online-and-virtual-cashbox')) {
        logger.info('✅ Allaqachon онлайн касса саҳифасида');
        return true;
      }

      // 1️⃣ "Xizmatlar" sahifasiga o'tish
      if (!currentUrl.includes('all-services')) {
        logger.info("📂 Xizmatlar sahifasiga o'tilmoqda...");

        // Xizmatlar linkini topish va bosish
        const servicesLink = this.page.locator('a[href*="all-services"]').first();
        const servicesLinkCount = await servicesLink.count();

        if (servicesLinkCount > 0) {
          await servicesLink.click();
          await this.page.waitForLoadState('networkidle');
          await this.page.waitForTimeout(2000);
        } else {
          // To'g'ridan-to'g'ri URL orqali o'tish
          logger.info("📂 Link topilmadi, URL orqali o'tilmoqda...");
          await this.page.goto('https://my3.soliq.uz/legal/cabinet/all-services');
          await this.page.waitForLoadState('networkidle');
          await this.page.waitForTimeout(2000);
        }
      }

      // 2️⃣ "Шахсий маълумотлар" collapse bo'limini ochish
      logger.info('📂 "Шахсий маълумотлар" бўлими очилмоқда...');

      const collapseHeader = this.page.locator(
        '.ant-collapse-header:has-text("Шахсий маълумотлар")'
      );
      const collapseHeaderCount = await collapseHeader.count();

      if (collapseHeaderCount > 0) {
        // aria-expanded="false" bo'lsa, bosish kerak
        const isExpanded = await collapseHeader.getAttribute('aria-expanded');

        if (isExpanded === 'false') {
          logger.info("📂 Bo'lim yopiq, ochilmoqda...");
          await collapseHeader.click();
          await this.page.waitForTimeout(1000);
        } else {
          logger.info("✅ Bo'lim allaqachon ochiq");
        }
      } else {
        logger.warn('⚠️ "Шахсий маълумотлар" bo\'limi topilmadi');
      }

      // 3️⃣ "Онлайн назорат касса техникаси" kartasiga bosish
      logger.info('🎯 "Онлайн касса техникаси" хизмати танланмоқда...');

      // Asosiy selector - href orqali
      const cashboxServiceSelector =
        'a[href="/remotes-services/online-and-virtual-cashbox/checks-info?interactiveId=632"]';

      // Kartani topish
      const cashboxCard = this.page.locator(cashboxServiceSelector);
      const cardCount = await cashboxCard.count();

      if (cardCount === 0) {
        logger.warn("⚠️ Karta topilmadi, alternativ selector ishlatiladi...");

        // Alternativ - matn orqali qidirish
        const altCard = this.page.locator(
          'a.all-services_serviceCard__Fw9gb:has-text("онлайн назорат касса")'
        );
        const altCardCount = await altCard.count();

        if (altCardCount > 0) {
          await altCard.first().scrollIntoViewIfNeeded();
          await this.page.waitForTimeout(500);
          await altCard.first().click();
        } else {
          logger.error("❌ Онлайн касса kartasi topilmadi");
          return false;
        }
      } else {
        // Scroll qilish (agar ko'rinmasa)
        await cashboxCard.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(500);

        // Bosish
        await cashboxCard.click();
      }

      logger.info('✅ Онлайн касса хизмати танланди');

      // Sahifa yuklanishini kutish
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(3000);

      // URL tekshirish
      const newUrl = this.page.url();
      if (newUrl.includes('checks-info') || newUrl.includes('online-and-virtual-cashbox')) {
        logger.info('✅ Онлайн касса саҳифаси очилди');
        return true;
      }

      logger.warn('⚠️ Sahifa ochildi, lekin URL kutilgandek emas: ' + newUrl);
      return true;
    } catch (error) {
      logger.error("❌ Xizmatga o'tishda xato:", error);
      return false;
    }
  }

  /**
   * Alternativ usul - to'g'ridan-to'g'ri URL orqali o'tish
   *
   * UI orqali o'tib bo'lmaganda ishlatiladi
   *
   * @returns Muvaffaqiyatli bo'lsa true
   */
  async navigateToOnlineCashboxDirect(): Promise<boolean> {
    try {
      logger.info("🔄 Онлайн касса саҳифасига тўғридан-тўғри ўтилмоқда...");

      const targetUrl =
        'https://my3.soliq.uz/remotes-services/online-and-virtual-cashbox/checks-info?interactiveId=632';

      await this.page.goto(targetUrl);
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(3000);

      logger.info('✅ Sahifa ochildi');
      return true;
    } catch (error) {
      logger.error("❌ Sahifaga o'tishda xato:", error);
      return false;
    }
  }

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
      logger.warn("⚠️ Qayta ishlanadigan cheklar yo'q");
      return { success: 0, failed: 0, total: 0 };
    }

    logger.info(
      `📊 ${selectChecksData.length} ta chek UI orqali qayta ishlanadi\n`
    );

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
        logger.info(
          `🔹 ${idx + 1}/${selectChecksData.length} - CHEK: ${chekRaqam}`
        );
        logger.info(`${'='.repeat(60)}`);
        logger.info(`   📦 MXIK: ${row.mxik || 'N/A'}`);
        logger.info(`   📏 Ulchov: ${row.ulchov || row.unit || 'N/A'}`);
        logger.info(`   💰 Faktura summa: ${row.amount || 'N/A'}`);
        logger.info(`   🔢 Miqdor: ${row.miqdor || row.amount || 'N/A'}`);
        logger.info(`   💵 Bir birlik: ${row.bir_birlik || 'N/A'}`);

        // 1️⃣ QIDIRISH - Chekni qidirish va "Batafsil" ochish
        logger.info(`\n   🔍 Chek qidirilmoqda...`);
        const searchSuccess = await performSearchAndOpenDetail(
          this.page,
          chekRaqam,
          2
        );

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
        const fillSuccess = await fillEditCheckFields(
          this.page,
          row,
          this.captchaApiKey
        );

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
      const chekRaqam = chekData.chek_raqam
        ? String(chekData.chek_raqam).trim()
        : '';

      if (!chekRaqam) {
        logger.error("❌ Chek raqami bo'sh");
        return false;
      }

      logger.info('\n' + '='.repeat(60));
      logger.info(`📝 BITTA CHEK QAYTA ISHLASH - ${chekRaqam}`);
      logger.info('='.repeat(60) + '\n');

      // 1. Qidirish
      logger.info('🔍 Chek qidirilmoqda...');
      const searchSuccess = await performSearchAndOpenDetail(
        this.page,
        chekRaqam
      );

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
      logger.info("📝 Ma'lumotlar to'ldirilmoqda...");
      const fillSuccess = await fillEditCheckFields(
        this.page,
        chekData,
        this.captchaApiKey
      );

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
      await this.page.waitForSelector('.ant-select-selection-item', {
        timeout,
      });

      logger.info("🟢 Fiskal modul render bo'ldi, 10 sekund kutiladi...");

      // Qo'shimcha stabilizatsiya uchun kutish
      await this.page.waitForTimeout(10000);

      logger.info('⏳ 10 sekund kutildi, jarayon davom etadi');
      return true;
    } catch (error) {
      logger.warn(
        '⚠️ Fiskal modul element topilmadi, 10 sekund kutiladi baribir...'
      );

      // Xato bo'lsa ham kutish
      await this.page.waitForTimeout(10000);
      return true;
    }
  }

  /**
   * Login holatini tekshirish
   *
   * Avval URL tekshiradi, keyin profil linkini, keyin dashboard elementlarini tekshiradi
   *
   * @returns Login qilgan bo'lsa true
   */
  async checkLoginStatus(): Promise<boolean> {
    try {
      const currentUrl = this.page.url();

      // 1. URL orqali tekshirish (eng ishonchli usul)
      if (currentUrl.includes('/legal')) {
        logger.info('✅ URL /legal - Foydalanuvchi tizimga kirgan');
        return true;
      }

      // Agar hali login sahifasida bo'lsa
      if (currentUrl.includes('/login')) {
        logger.warn('⚠️ Hali login sahifasida');
        return false;
      }

      // 2. Profil linki orqali tekshirish (juda ishonchli usul)
      try {
        const profileLink = this.page.locator(
          'a[href="/legal/cabinet/profile-new"]'
        );
        const profileCount = await profileLink.count();

        if (profileCount > 0) {
          const isProfileVisible = await profileLink
            .first()
            .isVisible({ timeout: 2000 });
          if (isProfileVisible) {
            logger.info(
              '✅ Profil linki topildi - Foydalanuvchi tizimga kirgan'
            );
            return true;
          }
        }
      } catch {
        // Agar profil linki topilmasa, davom etamiz
      }

      // 3. Dashboard selectorlari orqali tekshirish (fallback)
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
              logger.info(
                '✅ Dashboard element topildi - Foydalanuvchi tizimga kirgan'
              );
              return true;
            }
          }
        } catch {
          continue;
        }
      }

      // 4. Login sahifasi elementlari orqali tekshirish
      const loginSelectors = [
        'input[name="tin"]',
        'input[name="password"]',
        '.login-form',
      ];

      for (const selector of loginSelectors) {
        try {
          const element = this.page.locator(selector).first();
          const count = await element.count();

          if (count > 0) {
            const isVisible = await element.isVisible({ timeout: 2000 });
            if (isVisible) {
              logger.warn(
                '⚠️ Login form topildi - Foydalanuvchi hali tizimga kirmagan'
              );
              return false;
            }
          }
        } catch {
          continue;
        }
      }

      logger.warn(`⚠️ Login holati noma'lum - URL: ${currentUrl}`);
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
 * 2. Онлайн касса хизматига ўтиш (YANGI!)
 * 3. Fiskal modul yuklanishini kutish (10 sekund)
 * 4. Har bir chekni ketma-ket qayta ishlash:
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
      total: selectChecksData.length,
    };
  }

  // 2️⃣ ОНЛАЙН КАССА ХИЗМАТИГА ЎТИШ (YANGI!)
  logger.info("2️⃣ Онлайн касса хизматига ўтиш...");
  const navigationSuccess = await service.navigateToOnlineCashboxService();

  if (!navigationSuccess) {
    logger.warn(
      "⚠️ UI orqali o'tib bo'lmadi, to'g'ridan-to'g'ri URL ishlatiladi..."
    );
    const directSuccess = await service.navigateToOnlineCashboxDirect();

    if (!directSuccess) {
      logger.error('❌ Онлайн касса саҳифасига ўтиб бўлмади');
      return {
        success: 0,
        failed: selectChecksData.length,
        total: selectChecksData.length,
      };
    }
  }

  // 3️⃣ FISKAL MODUL KUTISH
  logger.info('3️⃣ Fiskal modul yuklanishi...');
  await service.waitForFiskalModule();

  // 4️⃣ CHEKLAR QAYTA ISHLASH
  logger.info('4️⃣ Cheklar qayta ishlash boshlandi...\n');
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