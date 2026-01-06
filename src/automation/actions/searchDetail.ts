import { Page } from 'playwright';
import { logger } from '../utils/logUtils';

/**
 * Chek qidirish va batafsil ochish
 */
export class SearchDetailAction {
  constructor(private page: Page) {}

  /**
   * Asosiy qidirish funksiyasi
   */
  async execute(
    chekRaqam: string,
    timeoutSearch: number = 20000,
    timeoutDetail: number = 30000
  ): Promise<boolean> {
    try {
      logger.info(`🔍 Chek qidirilmoqda: ${chekRaqam}`);

      // 1. Input maydonini topish va to'ldirish
      const inputFilled = await this.fillSearchInput(chekRaqam, timeoutSearch);
      if (!inputFilled) {
        logger.error(`❌ Chek ${chekRaqam}: Input maydoni topilmadi yoki to'ldirilmadi`);
        return false;
      }

      // 2. Qidirish tugmasini bosish
      const searchClicked = await this.clickSearchButton(timeoutSearch);
      if (!searchClicked) {
        logger.error(`❌ Chek ${chekRaqam}: Qidirish tugmasi bosilmadi`);
        return false;
      }

      logger.info(`🔍 Chek ${chekRaqam}: Qidirish bosildi`);

      // Natijalar yuklanishini kutish
      await this.page.waitForTimeout(2000);

      // 3. "Batafsil" tugmasini bosish
      const detailClicked = await this.clickBatafsil(chekRaqam, timeoutDetail);
      if (!detailClicked) {
        logger.error(`❌ Chek ${chekRaqam}: Batafsil topilmadi`);
        return false;
      }

      logger.info(`🟢 Chek ${chekRaqam}: Batafsil ochildi`);
      await this.page.waitForTimeout(2000);

      // 4. "Tahrirlash" tugmasini bosish
      const editClicked = await this.clickTahrirlash(chekRaqam, timeoutDetail);
      if (!editClicked) {
        logger.warn(`⚠️ Chek ${chekRaqam}: Tahrirlash tugmasi topilmadi`);
        return false;
      }

      logger.info(`✏️ Chek ${chekRaqam}: Tahrirlash tugmasi bosildi`);
      await this.page.waitForTimeout(1000);

      return true;
    } catch (error) {
      logger.error(`❌ Chek ${chekRaqam} qidirishda xato:`, error);
      return false;
    }
  }

  /**
   * Qidiruv inputini to'ldirish (React uchun to'g'ri usul)
   */
  private async fillSearchInput(chekRaqam: string, timeout: number): Promise<boolean> {
    const checkSelectors = [
      "input[name='check']",
      'input.ant-select-selection-search-input',
      "input.ant-input[name='check']",
      "input[placeholder*='Chek' i]",
      "input[placeholder*='чек' i]",
    ];

    let chekInput = null;

    // Input topish
    for (const selector of checkSelectors) {
      try {
        const input = this.page.locator(selector).first();
        const count = await input.count();

        if (count > 0) {
          const isVisible = await input.isVisible({ timeout: 2000 });
          if (isVisible) {
            chekInput = input;
            logger.info(`✅ Chek input topildi: ${selector}`);
            break;
          }
        }
      } catch {
        continue;
      }
    }

    if (!chekInput) {
      return false;
    }

    try {
      // Avvalgi qiymatni tekshirish
      const oldValue = await chekInput.inputValue();
      if (oldValue) {
        logger.info(`🧹 Avvalgi qiymat: '${oldValue}'`);
      }

      // React uchun to'g'ri usul - JavaScript orqali value o'zgartirish va eventlarni trigger qilish
      await chekInput.evaluate(
        (input: HTMLInputElement, newValue: string) => {
          // Native input value setter
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
          )?.set;

          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(input, newValue);
          } else {
            input.value = newValue;
          }

          // Event trigger qilish
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        },
        chekRaqam
      );

      await this.page.waitForTimeout(500);

      // Tekshirish
      const currentValue = await chekInput.inputValue();
      if (currentValue === chekRaqam) {
        logger.info(`✅ Chek raqami muvaffaqiyatli o'zgartirildi: ${chekRaqam}`);
        return true;
      } else {
        logger.warn(`⚠️ Qiymat kutilganidek emas: '${currentValue}' (kutilgan: ${chekRaqam})`);

        // Qayta urinish - oddiy fill bilan
        await chekInput.clear();
        await chekInput.fill(chekRaqam);
        await this.page.waitForTimeout(300);

        const retryValue = await chekInput.inputValue();
        if (retryValue === chekRaqam) {
          logger.info(`✅ Chek raqami kiritildi (retry)`);
          return true;
        }

        return false;
      }
    } catch (error) {
      logger.error('❌ Chek raqamini kiritishda xato:', error);
      return false;
    }
  }

  /**
   * Qidirish tugmasini bosish
   */
  private async clickSearchButton(timeout: number): Promise<boolean> {
    const searchXpaths = [
      "//button[contains(.,'Қидириш')]",
      "//button[contains(.,'Qidirish')]",
      "//button[contains(.,'Қидирув')]",
      "//button[contains(.,'Search')]",
      "//button[contains(.,'Поиск')]",
      "//input[@name='check']/ancestor::form//button[@type='submit']",
      "//input[@name='check']/ancestor::form//button",
    ];

    for (const xpath of searchXpaths) {
      try {
        const button = this.page.locator(`xpath=${xpath}`).first();
        const count = await button.count();

        if (count > 0) {
          const isVisible = await button.isVisible({ timeout: 2000 });

          if (isVisible) {
            try {
              await button.click({ timeout: 3000 });
            } catch {
              // JavaScript orqali bosish
              await button.evaluate((el) => (el as HTMLElement).click());
            }

            logger.info(`✅ Qidirish tugmasi bosildi`);
            return true;
          }
        }
      } catch {
        continue;
      }
    }

    logger.error('❌ Qidirish tugmasi topilmadi');
    return false;
  }

  /**
   * "Batafsil" tugmasini bosish
   */
  private async clickBatafsil(chekRaqam: string, timeout: number): Promise<boolean> {
    try {
      const batafsil = this.page
        .locator("xpath=//button[contains(.,'Batafsil') or contains(.,'Батафсил')]")
        .first();

      await batafsil.waitFor({ state: 'visible', timeout });
      await batafsil.click();

      logger.info(`🟢 Chek ${chekRaqam}: Batafsil ochildi`);
      return true;
    } catch (error) {
      logger.error(`❌ Chek ${chekRaqam}: Batafsil topilmadi`, error);
      return false;
    }
  }

  /**
   * "Tahrirlash" tugmasini bosish
   */
  private async clickTahrirlash(chekRaqam: string, timeout: number): Promise<boolean> {
    try {
      const xpaths = [
        "//button[contains(.,'Таҳрирлаш')]",
        "//button[contains(.,'Taxrirlash')]",
        "//button[contains(.,'Тахрирлаш')]",
        "//button[contains(.,'Tahrirlash')]",
        "//button[contains(.,'Edit')]",
        "//button[contains(.,'Редактировать')]",
      ];

      for (const xpath of xpaths) {
        try {
          const button = this.page.locator(`xpath=${xpath}`).first();
          const count = await button.count();

          if (count > 0) {
            await button.waitFor({ state: 'visible', timeout: 5000 });

            // JavaScript orqali bosish (ishonchli)
            await button.evaluate((el) => (el as HTMLElement).click());

            logger.info(`✏️ Chek ${chekRaqam}: Tahrirlash tugmasi bosildi`);
            return true;
          }
        } catch {
          continue;
        }
      }

      return false;
    } catch (error) {
      logger.error(`⚠️ Chek ${chekRaqam}: Tahrirlash tugmasi topilmadi`, error);
      return false;
    }
  }

  /**
   * Retry bilan qidirish
   */
  async executeWithRetry(chekRaqam: string, maxRetries: number = 2): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt > 1) {
        logger.info(`🔄 Chek ${chekRaqam} qidirish retry #${attempt}/${maxRetries}`);
        await this.page.waitForTimeout(1000);
      }

      const success = await this.execute(chekRaqam);

      if (success) {
        return true;
      }
    }

    logger.error(`❌ Chek ${chekRaqam} topilmadi (barcha urinishlar)`);
    return false;
  }
}

/**
 * Tez funksiya - chek qidirish va ochish
 */
export async function performSearchAndOpenDetail(
  page: Page,
  chekRaqam: string,
  maxRetries: number = 2
): Promise<boolean> {
  const action = new SearchDetailAction(page);
  return action.executeWithRetry(chekRaqam, maxRetries);
}