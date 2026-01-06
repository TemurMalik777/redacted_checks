import { Page } from 'playwright';
import { logger } from '../utils/logUtils';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ZIP fayl yuklash action
 */
export class UploadZipModalAction {
  constructor(private page: Page) {}

  /**
   * ZIP faylni yuklash
   */
  async execute(zipFolder: string = 'C:\\lll_ha', timeout: number = 12000): Promise<boolean> {
    try {
      logger.info('🔄 Fayl yuklash jarayoni boshlandi...');

      // 1. Papkadan .zip fayl topish
      const folderPath = path.resolve(zipFolder);

      if (!fs.existsSync(folderPath)) {
        throw new Error(`Zip papka topilmadi: ${folderPath}`);
      }

      const files = fs.readdirSync(folderPath);
      const zipFiles = files.filter((f) => f.endsWith('.zip')).sort();

      if (zipFiles.length === 0) {
        throw new Error(`Papka ichida .zip fayl topilmadi: ${folderPath}`);
      }

      const zipPath = path.join(folderPath, zipFiles[0]);
      logger.info(`📁 Yuklanadigan fayl: ${zipPath}`);

      // 2. Modal mavjudligini tekshirish
      await this.page.waitForSelector('div.ant-modal-root', { timeout });

      // 3. File input topish
      const fileInput = await this.findFileInput();

      if (!fileInput) {
        throw new Error('input[type=file] elementi topilmadi');
      }

      // 4. Faylni yuklash
      await fileInput.setInputFiles(zipPath);
      logger.info('⬆️ Fayl jo\'natildi, yuklanishi kutilyapti...');
      await this.page.waitForTimeout(600);

      // 5. Yuklangan fayl ro'yxatida ko'rinishini kutish
      const uploaded = await this.waitForFileUpload(path.basename(zipPath), timeout);

      if (!uploaded) {
        logger.warn('⚠️ Fayl yuklandi deb tasdiqlanmadi — ammo davom etamiz (timeout)');
      } else {
        logger.info('✅ Fayl ro\'yxatda ko\'rindi (yuklandi)');
      }

      // 6. Saqlash tugmasini bosish
      const saved = await this.clickSaveButton();

      if (!saved) {
        throw new Error('Saqlash tugmasi bosilmadi');
      }

      logger.info('💾 Saqlash tugmasi bosildi — davom etilmoqda');
      await this.page.waitForTimeout(800);

      return true;
    } catch (error) {
      logger.error('❌ Fayl yuklashda xatolik:', error);

      // Screenshot saqlash
      try {
        const screenshotDir = path.join(process.cwd(), 'screenshots');
        if (!fs.existsSync(screenshotDir)) {
          fs.mkdirSync(screenshotDir, { recursive: true });
        }

        const fname = path.join(screenshotDir, `upload_error_${Date.now()}.png`);
        await this.page.screenshot({ path: fname });
        logger.error(`Screenshot saqlandi: ${fname}`);
      } catch {
        logger.error('Screenshot saqlanmadi');
      }

      // HTML saqlash
      try {
        const htmlPath = path.join(process.cwd(), 'debug_upload_page.html');
        const html = await this.page.content();
        fs.writeFileSync(htmlPath, html, 'utf-8');
        logger.info('🧾 debug_upload_page.html saqlandi');
      } catch {
        // Ignore
      }

      return false;
    }
  }

  /**
   * File input topish
   */
  private async findFileInput(): Promise<any | null> {
    try {
      // Barcha file inputlarni topish
      const inputs = await this.page.locator('input[type="file"]').all();

      for (const input of inputs) {
        try {
          const accept = await input.getAttribute('accept');

          // ZIP qabul qiladigan input
          if (accept && accept.includes('zip')) {
            logger.info(`✅ File input topildi: accept="${accept}"`);
            return input;
          }

          // Yoki accept attribute bo'lmagan
          if (!accept || accept.trim() === '') {
            logger.info('✅ File input topildi (accept bo\'sh)');
            return input;
          }
        } catch {
          continue;
        }
      }

      // Fallback - birinchi input
      if (inputs.length > 0) {
        logger.warn('⚠️ ZIP input topilmadi, birinchi input ishlatiladi');
        return inputs[0];
      }

      return null;
    } catch (error) {
      logger.error('File input topishda xato:', error);
      return null;
    }
  }

  /**
   * Yuklangan faylni ro'yxatda kutish
   */
  private async waitForFileUpload(fileName: string, timeout: number): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const uploadedItems = await this.page
          .locator('.ant-upload-list-item, .ant-upload-list .ant-upload-list-item')
          .all();

        for (const item of uploadedItems) {
          try {
            const text = await item.textContent();

            if (text && (text.includes(fileName) || text.trim() !== '')) {
              logger.debug(`✅ Fayl ro'yxatda topildi: ${text.substring(0, 50)}`);
              return true;
            }
          } catch {
            continue;
          }
        }
      } catch {
        // Continue
      }

      await this.page.waitForTimeout(300);
    }

    return false;
  }

  /**
   * Saqlash tugmasini bosish
   */
  private async clickSaveButton(): Promise<boolean> {
    try {
      // 1. Matnli qidirish
      const textButtons = [
        "//button[normalize-space(text())='Сақлаш']",
        "//button[normalize-space(text())='Сохранить']",
        "//button[normalize-space(text())='Save']",
        "//button[contains(text(),'Сақлаш')]",
        "//button[contains(text(),'Saqlash')]",
      ];

      for (const xpath of textButtons) {
        try {
          const button = this.page.locator(`xpath=${xpath}`).first();
          const count = await button.count();

          if (count > 0) {
            const isVisible = await button.isVisible({ timeout: 2000 });

            if (isVisible) {
              await button.scrollIntoViewIfNeeded();
              await this.page.waitForTimeout(120);

              try {
                await button.click();
              } catch {
                await button.evaluate((el) => (el as HTMLElement).click());
              }

              logger.info('✅ Saqlash tugmasi bosildi (text)');
              return true;
            }
          }
        } catch {
          continue;
        }
      }

      // 2. Modal footerdagi tugmalar
      const footers = await this.page.locator('div.ant-modal-footer, div[role="dialog"] .ant-modal-footer').all();

      for (const footer of footers) {
        try {
          const buttons = await footer.locator('button').all();

          if (buttons.length >= 2) {
            // Oxirgi tugma odatda "Saqlash"
            const saveBtn = buttons[buttons.length - 1];

            await saveBtn.scrollIntoViewIfNeeded();
            await this.page.waitForTimeout(120);

            try {
              await saveBtn.click();
            } catch {
              await saveBtn.evaluate((el) => (el as HTMLElement).click());
            }

            logger.info('✅ Saqlash tugmasi bosildi (footer)');
            return true;
          }
        } catch {
          continue;
        }
      }

      throw new Error('Saqlash tugmasi topilmadi');
    } catch (error) {
      logger.error('Saqlash tugmasini bosishda xato:', error);
      return false;
    }
  }

  /**
   * Retry bilan yuklash
   */
  async executeWithRetry(zipFolder: string, maxRetries: number = 2): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt > 1) {
        logger.info(`🔄 ZIP yuklash retry #${attempt}/${maxRetries}`);
        await this.page.waitForTimeout(1000);
      }

      const success = await this.execute(zipFolder);

      if (success) {
        return true;
      }
    }

    logger.error('❌ ZIP yuklash muvaffaqiyatsiz (barcha urinishlar)');
    return false;
  }
}

/**
 * Tez funksiya - ZIP yuklash
 */
export async function uploadZipModal(
  page: Page,
  zipFolder: string = 'C:\\lll_ha',
  maxRetries: number = 2
): Promise<boolean> {
  const action = new UploadZipModalAction(page);
  return action.executeWithRetry(zipFolder, maxRetries);
}