import { Page } from 'playwright';
import { logger } from '../utils/logUtils';
import { AutomationHelpers } from '../utils/helper';

/**
 * Tahrirlash tugmasini bosish
 * Modal oynani ochish uchun ishlatiladi
 */
export class EditButtonAction {
  constructor(private page: Page) {}

  /**
   * Tahrirlash tugmasini topish va bosish
   */
  async execute(timeout: number = 10000): Promise<boolean> {
    try {
      logger.info('✏️ Tahrirlash tugmasi qidirilmoqda...');

      // Turli xil tillar va variantlar
      const xpathSelectors = [
        "//button[contains(.,'Таҳрирлаш')]",
        "//button[contains(.,'Taxrirlash')]",
        "//button[contains(.,'Тахрирлаш')]",
        "//button[contains(.,'Tahrirlash')]",
        "//button[contains(.,'Edit')]",
        "//button[contains(.,'Редактировать')]",
        "//button[contains(@aria-label,'Edit')]",
        "//button[contains(@aria-label,'Tahrirlash')]",
      ];

      for (const xpath of xpathSelectors) {
        try {
          const button = this.page.locator(`xpath=${xpath}`).first();
          const count = await button.count();

          if (count > 0) {
            // Element mavjudligini va ko'rinishini tekshirish
            const isVisible = await button.isVisible({ timeout: 2000 });

            if (isVisible) {
              logger.info(`✅ Tahrirlash tugmasi topildi: ${xpath.substring(0, 50)}...`);

              // Tugmani ko'rinadigan qilish
              await button.scrollIntoViewIfNeeded();
              await this.page.waitForTimeout(200);

              // JavaScript orqali bosish (ishonchli)
              await button.evaluate((el) => (el as HTMLElement).click());

              logger.info('✅ Tahrirlash tugmasi bosildi');

              // Modal ochilishini kutish
              await this.page.waitForTimeout(1000);

              // Modal ochilganligini tekshirish
              const modalOpened = await this.checkModalOpened();

              if (modalOpened) {
                logger.info('✅ Tahrirlash oynasi ochildi');
                return true;
              } else {
                logger.warn('⚠️ Modal ochilmadi, lekin tugma bosildi');
                return true; // Ba'zi hollarda modal kechikib ochilishi mumkin
              }
            }
          }
        } catch (error) {
          // Bu selector bilan topilmadi, keyingisiga o'tamiz
          continue;
        }
      }

      logger.error('❌ Tahrirlash tugmasi topilmadi');
      return false;
    } catch (error) {
      logger.error('❌ Tahrirlash tugmasini bosishda xato:', error);
      return false;
    }
  }

  /**
   * Modal ochilganligini tekshirish
   */
  private async checkModalOpened(timeout: number = 5000): Promise<boolean> {
    try {
      // Ant Design modal selectorlari
      const modalSelectors = [
        '.ant-modal-root',
        '.ant-modal-mask',
        '.ant-modal-wrap',
        'div[role="dialog"]',
      ];

      for (const selector of modalSelectors) {
        try {
          const modal = this.page.locator(selector).first();
          const count = await modal.count();

          if (count > 0) {
            const isVisible = await modal.isVisible({ timeout: 2000 });
            if (isVisible) {
              logger.debug(`✅ Modal topildi: ${selector}`);
              return true;
            }
          }
        } catch {
          continue;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Retry bilan tahrirlash tugmasini bosish
   */
  async executeWithRetry(maxRetries: number = 3, timeout: number = 10000): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info(`🔄 Tahrirlash tugmasi bosish urinishi ${attempt}/${maxRetries}`);

      const success = await this.execute(timeout);

      if (success) {
        return true;
      }

      if (attempt < maxRetries) {
        logger.warn(`⚠️ Tahrirlash tugmasi bosilmadi, qayta urinish...`);
        await this.page.waitForTimeout(1000);
      }
    }

    logger.error('❌ Tahrirlash tugmasini bosish muvaffaqiyatsiz (barcha urinishlar)');
    return false;
  }
}

/**
 * Tez funksiya - tahrirlash tugmasini bosish
 */
export async function clickEditButton(page: Page, maxRetries: number = 3): Promise<boolean> {
  const action = new EditButtonAction(page);
  return action.executeWithRetry(maxRetries);
}