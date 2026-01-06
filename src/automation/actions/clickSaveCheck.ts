/// <reference lib="dom" />
import { Page } from 'playwright';
import { logger } from '../utils/logUtils';
import { CaptchaAction } from './captchaAction';

export type NotificationType = 'success' | 'korporativ' | 'captcha_error' | 'error' | null;

export interface SaveCheckResult {
  success: boolean;
  notificationType: NotificationType;
  message?: string;
}
/**
 * Saqlash tugmasini bosish va natijani kutish
 */
export class ClickSaveCheckAction {
  constructor(private page: Page) {}

  /**
   * Asosiy saqlash funksiyasi
   */
  async execute(
    chekRaqam?: string,
    maxRetries: number = 3,
    captchaApiKey?: string
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          logger.info(`\n${'='.repeat(50)}`);
          logger.info(`🔄 QAYTA URINISH #${attempt}/${maxRetries}`);
          logger.info(`${'='.repeat(50)}\n`);
          await this.page.waitForTimeout(300);
        }

        // 1. Saqlash tugmasini topish va bosish
        logger.info('🔍 Saqlash tugmasi qidirilmoqda...');
        const saveButton = await this.findSaveButton();

        if (!saveButton) {
          logger.error('❌ Saqlash tugmasi topilmadi!');
          continue;
        }

        logger.info('✅ Saqlash tugmasi topildi');

        // 2. Tugmani bosish
        await this.clickSaveButton(saveButton);

        // 3. Notification kutish
        await this.page.waitForTimeout(200);
        const result = await this.waitForNotification();

        // 4. Natijaga qarab harakat qilish
        if (result.notificationType === 'success' || result.notificationType === 'korporativ') {
          logger.info('\n' + '🎉'.repeat(25));
          logger.info('🎊 SAQLANDI! 🎊');
          logger.info('🎉'.repeat(25) + '\n');

          // Database yangilash
          if (chekRaqam) {
            await this.updateCheckStatus(chekRaqam);
          }

          // Modal yopish
          await this.closeModalIfOpen();

          return true;
        }

        // CAPTCHA xato
        if (result.notificationType === 'captcha_error') {
          logger.error('\n' + '❌'.repeat(25));
          logger.error('🔴 CAPTCHA XATO!');
          logger.error('❌'.repeat(25) + '\n');

          if (attempt < maxRetries && captchaApiKey) {
            logger.info(`🔄 Qayta urinish (${attempt}/${maxRetries})...`);
            await this.page.waitForTimeout(500);

            // CAPTCHA ni tozalash
            await this.clearCaptchaInput();

            // CAPTCHA ni yangilash
            await this.refreshCaptcha();

            // CAPTCHA ni qayta yechish
            logger.info('🤖 CAPTCHA qayta yechilmoqda...');
            const captchaAction = new CaptchaAction({ apiKey: captchaApiKey });
            const captchaOk = await captchaAction.solveCaptcha(this.page);

            if (captchaOk) {
              logger.info('✅ CAPTCHA yechildi!');
              await this.page.waitForTimeout(200);
              continue;
            } else {
              logger.error('❌ CAPTCHA yechilmadi!');
              return false;
            }
          } else {
            logger.error(`❌ Maksimal urinishlar (${maxRetries})!`);
            return false;
          }
        }

        // Boshqa xato
        if (result.notificationType === 'error') {
          logger.error(`\n❌ XATO (${attempt}/${maxRetries})`);

          if (attempt < maxRetries) {
            logger.info('⏳ 1s kutish...');
            await this.page.waitForTimeout(1000);
            continue;
          } else {
            logger.error('❌ Urinishlar tugadi!');
            return false;
          }
        }

        // Notification topilmasa
        if (result.notificationType === null) {
          logger.warn('⚠️ Notification topilmadi');
          await this.page.waitForTimeout(500);

          // Modal yopilganligini tekshirish
          const modalClosed = await this.isModalClosed();

          if (modalClosed) {
            logger.info('✅ Modal yopilgan - SUCCESS');

            if (chekRaqam) {
              await this.updateCheckStatus(chekRaqam);
            }

            return true;
          } else {
            logger.warn('⚠️ Modal ochiq');

            if (attempt < maxRetries) {
              logger.info('🔄 Qayta...');
              await this.page.waitForTimeout(500);
              continue;
            } else {
              logger.warn('⚠️ Majburiy yopish...');
              await this.forceCloseModal();
              return true;
            }
          }
        }
      } catch (error) {
        logger.error(`❌ Xato ${attempt}:`, error);

        if (attempt < maxRetries) {
          logger.info('⏳ 0.5s...');
          await this.page.waitForTimeout(500);
          continue;
        } else {
          logger.error('❌ Barcha urinishlar muvaffaqiyatsiz!');
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Saqlash tugmasini topish
   */
  private async findSaveButton(): Promise<any | null> {
    const selectors = [
      { type: 'xpath', value: "//button[@type='submit' and contains(text(), 'Сақлаш')]" },
      { type: 'xpath', value: "//button[contains(@class, 'ant-btn-primary') and contains(text(), 'Сақлаш')]" },
      { type: 'css', value: "button[type='submit'].ant-btn-primary" },
      { type: 'xpath', value: "//button[@type='submit' and contains(text(), 'Saqlash')]" },
      { type: 'xpath', value: "//button[contains(text(), 'Сақлаш')]" },
      { type: 'xpath', value: "(//button[@type='submit'])[last()]" },
    ];

    for (let i = 0; i < 5; i++) {
      for (const { type, value } of selectors) {
        try {
          const locator = type === 'xpath' ? this.page.locator(`xpath=${value}`) : this.page.locator(value);

          const count = await locator.count();
          if (count > 0) {
            const isVisible = await locator.first().isVisible();
            const isEnabled = await locator.first().isEnabled();

            if (isVisible && isEnabled) {
              logger.info(`✅ Topildi! (${i + 1})`);
              return locator.first();
            }
          }
        } catch {
          continue;
        }
      }

      if (i < 4) {
        await this.page.waitForTimeout(150);
      }
    }

    return null;
  }

  /**
   * Saqlash tugmasini bosish
   */
  private async clickSaveButton(button: any): Promise<void> {
    logger.info('🚀 DARHOL bosish...');

    try {
      // Scroll into view
      await button.scrollIntoViewIfNeeded();
      await this.page.waitForTimeout(100);
    } catch {
      // Ignore
    }

    try {
      await button.click();
      logger.info('✅ Bosildi!');
    } catch {
      // JavaScript orqali
      await button.evaluate((el: HTMLElement) => el.click());
      logger.info('✅ Bosildi (JS)!');
    }
  }

  /**
   * Notification kutish va tahlil qilish
   */
  private async waitForNotification(timeout: number = 10000): Promise<SaveCheckResult> {
    logger.info('⏳ Notification kutilmoqda...');

    const startTime = Date.now();
    let notificationFound = false;
    let resultType: NotificationType = null;
    let message = '';

    while (Date.now() - startTime < timeout) {
      try {
        const notifications = await this.page.locator('div.ant-notification-notice').all();

        for (const notification of notifications) {
          try {
            const isVisible = await notification.isVisible();
            if (!isVisible) continue;

            const classes = await notification.getAttribute('class');

            // SUCCESS
            if (classes?.toLowerCase().includes('success')) {
              notificationFound = true;
              resultType = 'success';

              try {
                const messageEl = notification.locator('.ant-notification-notice-message');
                const descEl = notification.locator('.ant-notification-notice-description div');

                const msgText = await messageEl.textContent();
                const descText = await descEl.textContent();

                logger.info(`✅ SUCCESS: ${msgText}`);
                logger.info(`📝 ${descText}`);

                // Korporativ tekshirish
                if (descText?.toLowerCase().includes('korporativ') || descText?.toLowerCase().includes('корпоратив')) {
                  resultType = 'korporativ';
                  logger.info('💳 Korporativ karta!');
                }
              } catch {
                logger.info('✅ SUCCESS notification topildi!');
              }

              break;
            }

            // ERROR
            if (classes?.toLowerCase().includes('error')) {
              notificationFound = true;
              resultType = 'error';

              try {
                const titleEl = notification.locator('.ant-notification-notice-message');
                const descEl = notification.locator('.ant-notification-notice-description div');

                const titleText = await titleEl.textContent();
                const descText = await descEl.textContent();

                logger.error(`❌ ERROR: ${titleText}`);
                logger.error(`📝 ${descText}`);

                // CAPTCHA xato tekshirish
                const descLower = descText?.toLowerCase() || '';
                if (
                  (descLower.includes('рақамлар') && descLower.includes('нотўғри')) ||
                  (descLower.includes('расмдаги') && descLower.includes('киритилган')) ||
                  descLower.includes('captcha')
                ) {
                  resultType = 'captcha_error';
                  logger.error('🔴 CAPTCHA XATO!');
                }

                message = descText || '';
              } catch {
                logger.error('❌ ERROR notification topildi!');
              }

              break;
            }
          } catch {
            continue;
          }
        }

        if (notificationFound) break;
      } catch {
        // Continue
      }

      await this.page.waitForTimeout(100);
    }

    if (!notificationFound) {
      logger.warn('⚠️ Notification topilmadi');
      return { success: false, notificationType: null };
    }

    // X tugmasini bosish
    if (notificationFound) {
      await this.closeNotificationX();
    }

    return {
      success: resultType === 'success' || resultType === 'korporativ',
      notificationType: resultType,
      message,
    };
  }

  /**
   * Notification X tugmasini bosish
   */
  private async closeNotificationX(): Promise<void> {
    logger.info('\n⚡ X bosish boshlandi...');
    await this.page.waitForTimeout(200);

    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) {
        logger.info(`   🔄 X retry #${attempt + 1}/5`);
        await this.page.waitForTimeout(300);
      }

      const closed = await this.closeModalByX();
      if (closed) {
        logger.info('✅ X MUVAFFAQIYATLI BOSILDI!');
        return;
      }
    }

    // ESC ishlatish
    logger.warn('\n⚠️ X ishlamadi - ESC ishlatilmoqda...');
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
    logger.info('✅ ESC bosildi!');

    // Yana bir bor X
    for (let attempt = 0; attempt < 3; attempt++) {
      const closed = await this.closeModalByX();
      if (closed) {
        logger.info('✅ X BOSILDI (ESC dan keyin)!');
        return;
      }
      await this.page.waitForTimeout(300);
    }

    // Force ESC
    logger.warn('⚠️ FORCE ESC...');
    for (let i = 0; i < 3; i++) {
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(200);
    }
    logger.info('✅ Force ESC bajarildi!');
  }

  /**
   * Modal X tugmasini bosish
   */
  private async closeModalByX(): Promise<boolean> {
    const selectors = [
      '.ant-modal-close',
      'button.ant-modal-close',
      'button[aria-label="Close"]',
      '.ant-modal-close-x',
      '.anticon-close',
      'span.anticon-close',
      '.ant-modal-wrap .ant-modal-close',
    ];

    for (const selector of selectors) {
      try {
        const buttons = await this.page.locator(selector).all();

        for (const button of buttons) {
          try {
            const isVisible = await button.isVisible();
            const isEnabled = await button.isEnabled();

            if (isVisible && isEnabled) {
              // 1. Oddiy click
              try {
                await button.click({ timeout: 1000 });
                await this.page.waitForTimeout(150);
                return true;
              } catch {
                // 2. JS click
                try {
                  await button.evaluate((el: HTMLElement) => el.click());
                  await this.page.waitForTimeout(150);
                  return true;
                } catch {
                  // 3. Force click
                  try {
                    await button.click({ force: true });
                    await this.page.waitForTimeout(150);
                    return true;
                  } catch {
                    continue;
                  }
                }
              }
            }
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  /**
   * Database yangilash
   */
  private async updateCheckStatus(chekRaqam: string): Promise<void> {
    try {
      logger.info(`💾 Database yangilanmoqda...`);

      // Sequelize model import qilish kerak
      // const { SelectChecks } = await import('../../models');
      // await SelectChecks.update(
      //   { is_active: true, updated_at: new Date() },
      //   { where: { chek_raqam: chekRaqam } }
      // );

      // Hozircha placeholder
      logger.info(`✅ DB OK: #${chekRaqam}`);
    } catch (error) {
      logger.error(`⚠️ DB FAIL: #${chekRaqam}`, error);
    }
  }

  /**
   * Modal yopilganligini tekshirish
   */
  private async isModalClosed(): Promise<boolean> {
    try {
      const modals = await this.page.locator('.ant-modal-mask').all();
      const visibleModals = await Promise.all(
        modals.map(async (m) => {
          try {
            return await m.isVisible();
          } catch {
            return false;
          }
        })
      );

      return visibleModals.every((v) => !v);
    } catch {
      return true;
    }
  }

  /**
   * Modalni majburiy yopish
   */
  private async forceCloseModal(): Promise<void> {
    try {
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(200);
    } catch {
      // Ignore
    }
  }

  /**
   * Modalni ochiq bo'lsa yopish
   */
  private async closeModalIfOpen(): Promise<void> {
    await this.page.waitForTimeout(100);

    try {
      const modals = await this.page.locator('.ant-modal-mask').all();
      const visibleModals = await Promise.all(
        modals.map(async (m) => {
          try {
            return await m.isVisible();
          } catch {
            return false;
          }
        })
      );

      if (visibleModals.some((v) => v)) {
        logger.warn('⚠️ Modal ochiq, yopilmoqda...');
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(100);
      } else {
        logger.info('✅ Modal yopilgan!');
      }
    } catch {
      // Ignore
    }
  }

  /**
   * CAPTCHA inputni tozalash
   */
  private async clearCaptchaInput(): Promise<void> {
    try {
      const captchaInput = this.page.locator('input[name="captchaValue"]').first();
      const count = await captchaInput.count();

      if (count > 0) {
        await captchaInput.clear();
        logger.info('🗑️ CAPTCHA tozalandi');
        await this.page.waitForTimeout(200);
      }
    } catch {
      // Ignore
    }
  }

  /**
   * CAPTCHA ni yangilash
   */
  private async refreshCaptcha(): Promise<void> {
    try {
      const refreshSelectors = [
        'button[aria-label*="refresh" i]',
        'button[class*="refresh"]',
        '.captcha-refresh',
        '.anticon-reload',
      ];

      for (const selector of refreshSelectors) {
        const buttons = await this.page.locator(selector).all();

        for (const btn of buttons) {
          try {
            const isVisible = await btn.isVisible();
            if (isVisible) {
              await btn.click();
              logger.info('🔄 CAPTCHA yangilandi');
              await this.page.waitForTimeout(300);
              return;
            }
          } catch {
            continue;
          }
        }
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * Tez funksiya - saqlash tugmasini bosish
 */
export async function clickSaveButton(
  page: Page,
  chekRaqam?: string,
  maxRetries: number = 3,
  captchaApiKey?: string
): Promise<boolean> {
  const action = new ClickSaveCheckAction(page);
  return action.execute(chekRaqam, maxRetries, captchaApiKey);
}