import { Page } from 'playwright';
import axios from 'axios';
import { logger } from '../utils/logUtils';

interface CaptchaConfig {
  apiKey: string;
  apiUrl?: string;
  maxAttempts?: number;
  pollInterval?: number;
}

/**
 * CAPTCHA yechish action
 * 2Captcha API yoki boshqa CAPTCHA solving service bilan ishlaydi
 */
export class CaptchaAction {
  private config: Required<CaptchaConfig>;

  constructor(config: CaptchaConfig) {
    this.config = {
      apiKey: config.apiKey,
      apiUrl: config.apiUrl || 'http://2captcha.com',
      maxAttempts: config.maxAttempts || 120,
      pollInterval: config.pollInterval || 3000,
    };
  }

  /**
   * Asosiy CAPTCHA yechish funksiyasi
   */
  async solveCaptcha(page: Page): Promise<boolean> {
    try {
      logger.info('🤖 CAPTCHA yechish boshlandi...');

      // 1. CAPTCHA mavjudligini tekshirish
      const hasCaptcha = await this.checkCaptchaExists(page);
      if (!hasCaptcha) {
        logger.info('✅ CAPTCHA topilmadi - o\'tkazib yuborildi');
        return true;
      }

      // 2. CAPTCHA rasmini olish
      const captchaImage = await this.getCaptchaImage(page);
      if (!captchaImage) {
        logger.error('❌ CAPTCHA rasmi olinmadi');
        return false;
      }

      // 3. 2Captcha API ga yuborish
      const captchaText = await this.solveCaptchaWith2Captcha(captchaImage);
      if (!captchaText) {
        logger.error('❌ CAPTCHA yechildi, lekin javob bo\'sh');
        return false;
      }

      // 4. CAPTCHA ni inputga kiritish
      const filled = await this.fillCaptchaInput(page, captchaText);
      if (!filled) {
        logger.error('❌ CAPTCHA input maydoniga yozilmadi');
        return false;
      }

      logger.info(`✅ CAPTCHA muvaffaqiyatli yechildi: ${captchaText}`);
      return true;
    } catch (error) {
      logger.error('❌ CAPTCHA yechishda xato:', error);
      return false;
    }
  }

  /**
   * CAPTCHA mavjudligini tekshirish
   */
  private async checkCaptchaExists(page: Page): Promise<boolean> {
    try {
      const captchaSelectors = [
        'img[alt*="captcha" i]',
        'img[src*="captcha" i]',
        'img.captcha-image',
        'img[id*="captcha" i]',
        '.captcha img',
        '[class*="captcha"] img',
      ];

      for (const selector of captchaSelectors) {
        const exists = await page.locator(selector).count();
        if (exists > 0) {
          logger.info(`🖼️ CAPTCHA topildi: ${selector}`);
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('CAPTCHA tekshirishda xato:', error);
      return false;
    }
  }

  /**
   * CAPTCHA rasmini base64 formatda olish
   */
  private async getCaptchaImage(page: Page): Promise<string | null> {
    try {
      const captchaSelectors = [
        'img[alt*="captcha" i]',
        'img[src*="captcha" i]',
        'img.captcha-image',
        'img[id*="captcha" i]',
      ];

      for (const selector of captchaSelectors) {
        const captchaElement = page.locator(selector).first();
        const count = await captchaElement.count();

        if (count > 0) {
          // Screenshot olish va base64 ga konvertatsiya
          const screenshot = await captchaElement.screenshot();
          const base64Image = screenshot.toString('base64');

          logger.info('📸 CAPTCHA rasmi olindi');
          return base64Image;
        }
      }

      return null;
    } catch (error) {
      logger.error('CAPTCHA rasmini olishda xato:', error);
      return null;
    }
  }

  /**
   * 2Captcha API orqali CAPTCHA yechish
   */
  private async solveCaptchaWith2Captcha(base64Image: string): Promise<string | null> {
    try {
      logger.info('📤 2Captcha API ga yuborilmoqda...');

      // 1. CAPTCHA yuborish
      const submitResponse = await axios.post(
        `${this.config.apiUrl}/in.php`,
        {
          key: this.config.apiKey,
          method: 'base64',
          body: base64Image,
          json: 1,
        }
      );

      if (submitResponse.data.status !== 1) {
        logger.error('❌ 2Captcha yuborishda xato:', submitResponse.data);
        return null;
      }

      const captchaId = submitResponse.data.request;
      logger.info(`✅ CAPTCHA yuborildi. ID: ${captchaId}`);

      // 2. Natijani polling orqali olish
      logger.info('⏳ Natija kutilmoqda...');

      for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
        await this.sleep(this.config.pollInterval);

        const resultResponse = await axios.get(
          `${this.config.apiUrl}/res.php`,
          {
            params: {
              key: this.config.apiKey,
              action: 'get',
              id: captchaId,
              json: 1,
            },
          }
        );

        if (resultResponse.data.status === 1) {
          const captchaText = resultResponse.data.request;
          logger.info(`✅ CAPTCHA yechildi: ${captchaText}`);
          return captchaText;
        }

        if (resultResponse.data.request === 'CAPCHA_NOT_READY') {
          logger.debug(`⏳ Kutilmoqda... (${attempt + 1}/${this.config.maxAttempts})`);
          continue;
        }

        // Boshqa xato
        logger.error('❌ 2Captcha xatosi:', resultResponse.data);
        return null;
      }

      logger.error('❌ CAPTCHA timeout (maksimal urinishlar oshdi)');
      return null;
    } catch (error) {
      logger.error('❌ 2Captcha API da xato:', error);
      return null;
    }
  }

  /**
   * CAPTCHA ni input maydoniga kiritish
   */
  private async fillCaptchaInput(page: Page, captchaText: string): Promise<boolean> {
    try {
      const inputSelectors = [
        'input[name="captcha"]',
        'input[name="captchaValue"]',
        'input[id*="captcha" i]',
        'input[placeholder*="captcha" i]',
        'input.captcha-input',
      ];

      for (const selector of inputSelectors) {
        const input = page.locator(selector).first();
        const count = await input.count();

        if (count > 0) {
          // Inputni tozalash va to'ldirish
          await input.clear();
          await input.fill(captchaText);

          // React uchun eventlarni trigger qilish
          await input.evaluate((el) => {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          });

          logger.info(`✅ CAPTCHA inputga kiritildi: ${selector}`);
          return true;
        }
      }

      logger.error('❌ CAPTCHA input maydoni topilmadi');
      return false;
    } catch (error) {
      logger.error('CAPTCHA kiritishda xato:', error);
      return false;
    }
  }

  /**
   * CAPTCHA ni refresh qilish
   */
  async refreshCaptcha(page: Page): Promise<boolean> {
    try {
      logger.info('🔄 CAPTCHA yangilanmoqda...');

      const refreshSelectors = [
        'button[aria-label*="refresh" i]',
        'button[class*="refresh"]',
        '.captcha-refresh',
        '.anticon-reload',
        'button:has(.anticon-reload)',
      ];

      for (const selector of refreshSelectors) {
        const button = page.locator(selector).first();
        const count = await button.count();

        if (count > 0 && (await button.isVisible())) {
          await button.click();
          await page.waitForTimeout(500);
          logger.info('✅ CAPTCHA yangilandi');
          return true;
        }
      }

      logger.warn('⚠️ CAPTCHA refresh tugmasi topilmadi');
      return false;
    } catch (error) {
      logger.error('CAPTCHA yangilashda xato:', error);
      return false;
    }
  }

  /**
   * Retry bilan CAPTCHA yechish
   */
  async solveCaptchaWithRetry(
    page: Page,
    maxRetries: number = 3
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info(`🔄 CAPTCHA yechish urinishi ${attempt}/${maxRetries}`);

      const success = await this.solveCaptcha(page);

      if (success) {
        return true;
      }

      if (attempt < maxRetries) {
        logger.warn(`⚠️ CAPTCHA yechilmadi, qayta urinish...`);
        await this.refreshCaptcha(page);
        await this.sleep(1000);
      }
    }

    logger.error('❌ CAPTCHA yechish muvaffaqiyatsiz (barcha urinishlar)');
    return false;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Tez funksiya - CAPTCHA yechish
 */
export async function solveCaptcha(
  page: Page,
  apiKey: string,
  maxRetries: number = 3
): Promise<boolean> {
  const captchaAction = new CaptchaAction({ apiKey });
  return captchaAction.solveCaptchaWithRetry(page, maxRetries);
}