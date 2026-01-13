// src/automation/workflows/checkProcessingWorkflow.ts

import { Page } from 'playwright';
import { BrowserManager } from '../utils/browserManager';
import { FiscalModalAction } from '../actions/fiscalModalAction';
import { SearchCheckAction } from '../actions/searchCheckAction';
import { CheckStatusUpdater } from '../actions/updateCheckStatus';
import { logInfo, logError } from '../utils/logUtils';

export class CheckProcessingWorkflow {
  private browserManager: BrowserManager;
  private page: Page | null = null;
  private checkStatusUpdater: CheckStatusUpdater;

  constructor() {
    this.browserManager = new BrowserManager();
    this.checkStatusUpdater = new CheckStatusUpdater();
  }

  /**
   * Login bo'lishini kutish - URL va profil linkini kuzatish
   */
  private async waitForLogin(page: Page, timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    const checkIntervalMs = 2000; // Har 2 sekundda tekshirish
    let lastLogTime = 0;

    logInfo('⏳ Login kutilmoqda...');
    logInfo(`📍 Login URL: https://my3.soliq.uz/login`);
    logInfo(`🎯 Maqsad URL: https://my3.soliq.uz/legal`);

    while (Date.now() - startTime < timeoutMs) {
      try {
        const currentUrl = page.url();

        // Login muvaffaqiyatli - URL /legal ga o'zgardi
        if (currentUrl.includes('/legal')) {
          logInfo(`✅ Login muvaffaqiyatli! URL: ${currentUrl}`);
          // Sahifa to'liq yuklanishini kutish
          await page
            .waitForLoadState('networkidle', { timeout: 10000 })
            .catch(() => {
              logInfo('⚠️ networkidle timeout, lekin davom etamiz');
            });
          return true;
        }

        // Qo'shimcha tekshirish - profil linki mavjudligini tekshirish
        try {
          const profileLink = page.locator(
            'a[href="/legal/cabinet/profile-new"]',
          );
          const count = await profileLink.count();
          if (count > 0) {
            const isVisible = await profileLink
              .first()
              .isVisible({ timeout: 1000 });
            if (isVisible) {
              logInfo(
                `✅ Login muvaffaqiyatli! Profil linki topildi: ${currentUrl}`,
              );
              return true;
            }
          }
        } catch {
          // Agar profil linki topilmasa, davom etamiz
        }

        // Har 10 sekundda status log qilish (5 sekund o'rniga)
        if (Date.now() - lastLogTime > 10000) {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const remaining = Math.floor(
            (timeoutMs - (Date.now() - startTime)) / 1000,
          );
          logInfo(
            `⏱️  Login kutilmoqda... O'tgan: ${elapsed}s / Qolgan: ${remaining}s`,
          );
          lastLogTime = Date.now();
        }

        // 2 sekund kutish
        await page.waitForTimeout(checkIntervalMs);
      } catch (error) {
        logError(`⚠️ URL tekshirishda xato:`, error);
        // Xatoga qaramay davom etamiz
        await page.waitForTimeout(checkIntervalMs);
      }
    }

    // Timeout
    logError(
      `❌ Login timeout - ${timeoutMs / 1000} sekund ichida login qilinmadi`,
    );
    logError(`📍 Oxirgi URL: ${page.url()}`);
    return false;
  }

  async run(checkNumbers: string[]): Promise<void> {
    try {
      logInfo(`🚀 Starting workflow for ${checkNumbers.length} checks...`);

      // 1. Browser ochish
      this.page = await this.browserManager.initialize(false);

      // 2. Login sahifasiga o'tish
      await this.page.goto('https://my3.soliq.uz/login', {
        waitUntil: 'networkidle',
      });

      logInfo('⏸️ Please login manually...');
      console.log('\n' + '='.repeat(60));
      console.log('⚠️  ILTIMOS, LOGIN QILING!');
      console.log('📍 Joriy URL: https://my3.soliq.uz/login');
      console.log("🎯 Login muvaffaqiyatli bo'lgandan keyin URL o'zgaradi:");
      console.log('   https://my3.soliq.uz/legal');
      console.log('='.repeat(60) + '\n');

      // 3. Login kutish - /legal sahifasiga redirect bo'lishini kutish
      const loginSuccess = await this.waitForLogin(this.page, 180000);

      if (!loginSuccess) {
        throw new Error('Login timeout - 3 daqiqa ichida login qilinmadi');
      }

      logInfo('✅ Login successful!');

      // 4. Fiscal modal handle
      const modalHandled = await FiscalModalAction.handleFiscalModal(this.page);
      if (!modalHandled) {
        throw new Error('Failed to configure fiscal module');
      }

      // 5. Har bir chekni qayta ishlash
      let processed = 0;
      let found = 0;

      for (const checkNumber of checkNumbers) {
        try {
          const result = await SearchCheckAction.searchCheck(
            this.page,
            checkNumber,
          );

          // Database'ni yangilash
          await this.checkStatusUpdater.updateCheckStatus(
            checkNumber,
            result.found,
            result.details,
          );

          if (result.found) found++;
          processed++;

          logInfo(
            `✅ ${processed}/${checkNumbers.length} - Check: ${checkNumber} - Found: ${result.found}`,
          );

          // Har bir qidiruv orasida 2-3 sekund kutish
          await new Promise((resolve) => setTimeout(resolve, 2500));
        } catch (error) {
          logError(`❌ Failed to process check: ${checkNumber}`, error);
        }
      }

      logInfo(
        `🎉 Workflow completed! Processed: ${processed}, Found: ${found}`,
      );
    } catch (error) {
      logError('❌ Workflow failed', error);
      throw error;
    } finally {
      if (this.page) {
        await this.browserManager.close();
      }
    }
  }
}
