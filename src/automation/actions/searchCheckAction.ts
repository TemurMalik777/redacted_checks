// src/automation/actions/searchCheckAction.ts

import { Page } from 'playwright';
import { CHECK_SEARCH_SELECTORS } from '../utils/selectors';
import { AutomationHelpers } from '../utils/helper';
import { logInfo, logError, logWarn } from '../utils/logUtils';

export interface CheckSearchResult {
  found: boolean;
  checkNumber: string;
  details?: {
    fiscalSign?: string;
    totalAmount?: number;
    dateTime?: string;
  };
}

export class SearchCheckAction {
  /**
   * 🔍 Chek raqami bo'yicha qidirish
   */
  static async searchCheck(page: Page, checkNumber: string): Promise<CheckSearchResult> {
    try {
      logInfo(`🔍 Searching for check: ${checkNumber}`);

      // 1. "Чек маълумотлари" tabiga o'tish (agar kerak bo'lsa)
      await this.ensureCheckTab(page);

      // 2. Fiskal modul allaqachon to'ldirilganligini tekshirish
      const fiscalFilled = await this.isFiscalModuleFilled(page);
      if (!fiscalFilled) {
        logError('❌ Fiscal module is not filled!');
        return { found: false, checkNumber };
      }

      // 3. Chek raqamini "Чек рақами" filteriga kiritish
      // Bu joyda siz checkbox'ni enable qilishingiz va input'ga yozishingiz kerak
      // Lekin rasmda faqat fiskal modul ko'rinadi, shuning uchun:
      
      // Variant 1: Agar alohida "Чек рақами" input bo'lsa
      const checkInputExists = await AutomationHelpers.elementExists(
        page,
        'input[placeholder*="Чек рақами"]'
      );

      if (checkInputExists) {
        await AutomationHelpers.safeFill(
          page,
          'input[placeholder*="Чек рақами"]',
          checkNumber
        );
      } else {
        // Variant 2: Fiskal modul inputiga chek raqamini qo'shamiz
        logWarn('⚠️ Check number input not found - using fiscal module field');
        const currentValue = await page.inputValue(CHECK_SEARCH_SELECTORS.fiscalModuleInput);
        await page.fill(
          CHECK_SEARCH_SELECTORS.fiscalModuleInput,
          `${currentValue} ${checkNumber}`.trim()
        );
      }

      await AutomationHelpers.randomDelay(300, 500);

      // 4. "Қидириш" tugmasini bosish
      const searchClicked = await AutomationHelpers.safeClick(
        page,
        CHECK_SEARCH_SELECTORS.searchButton
      );

      if (!searchClicked) {
        // Alternative selector
        await AutomationHelpers.safeClick(
          page,
          CHECK_SEARCH_SELECTORS.searchButtonAlt
        );
      }

      // 5. Natijalarni kutish
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      await AutomationHelpers.randomDelay(1500, 2000);

      // 6. Natijalarni tekshirish
      const resultFound = await this.checkResults(page);

      if (resultFound) {
        logInfo(`✅ Check found: ${checkNumber}`);
        const details = await this.extractCheckDetails(page);
        return { found: true, checkNumber, details };
      } else {
        logWarn(`⚠️ Check not found: ${checkNumber}`);
        return { found: false, checkNumber };
      }
    } catch (error) {
      logError(`❌ Search failed for check: ${checkNumber}`, error);
      return { found: false, checkNumber };
    }
  }

  /**
   * "Чек маълумотлари" tabida ekanligini tekshirish
   */
  private static async ensureCheckTab(page: Page): Promise<void> {
    try {
      const tabElement = await page.$(CHECK_SEARCH_SELECTORS.checkInfoTab);
      
      if (tabElement) {
        // Tab bosilganligini tekshirish (active class yoki attribute)
        const isActive = await tabElement.evaluate((el) => {
          return el.classList.contains('Mui-selected') || 
                 el.getAttribute('aria-selected') === 'true';
        });

        if (!isActive) {
          await tabElement.click();
          await AutomationHelpers.randomDelay(800, 1200);
          logInfo('✅ Switched to "Чек маълумотлари" tab');
        }
      }
    } catch (error) {
      logWarn('⚠️ Could not verify tab state', error);
    }
  }

  /**
   * Fiskal modul to'ldirilganligini tekshirish
   */
  private static async isFiscalModuleFilled(page: Page): Promise<boolean> {
    try {
      let inputSelector = CHECK_SEARCH_SELECTORS.fiscalModuleInput;
      let exists = await AutomationHelpers.elementExists(page, inputSelector);

      if (!exists) {
        inputSelector = CHECK_SEARCH_SELECTORS.fiscalModuleInputAlt;
        exists = await AutomationHelpers.elementExists(page, inputSelector);
      }

      if (!exists) return false;

      const value = await page.inputValue(inputSelector);
      return value.trim().length > 5; // Kamida 5 belgi
    } catch {
      return false;
    }
  }

  /**
   * Natijalar jadvalida ma'lumot borligini tekshirish
   */
  private static async checkResults(page: Page): Promise<boolean> {
    try {
      // "0 та бахо" xabari bormi?
      const noResults = await AutomationHelpers.elementExists(
        page,
        CHECK_SEARCH_SELECTORS.noResults
      );

      if (noResults) {
        logWarn('⚠️ "0 results" message found');
        return false;
      }

      // Jadvalda qator bormi?
      const tableExists = await AutomationHelpers.elementExists(
        page,
        CHECK_SEARCH_SELECTORS.resultsTable
      );

      if (!tableExists) {
        logWarn('⚠️ Results table not found');
        return false;
      }

      const rows = await page.$$(CHECK_SEARCH_SELECTORS.tableRow);
      return rows.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Chek tafsilotlarini olish
   */
  private static async extractCheckDetails(page: Page): Promise<any> {
    try {
      const rows = await page.$$(CHECK_SEARCH_SELECTORS.tableRow);
      
      if (rows.length === 0) return {};

      const firstRow = rows[0];
      
      // Har bir ustundan ma'lumot olish
      const cells = await firstRow.$$('td');
      
      if (cells.length < 3) return {};

      const fiscalSign = await cells[1]?.textContent();
      const totalAmountText = await cells[2]?.textContent();
      const dateTime = await cells[3]?.textContent();

      const totalAmount = totalAmountText
        ? parseFloat(totalAmountText.replace(/[^\d.]/g, ''))
        : 0;

      return {
        fiscalSign: fiscalSign?.trim(),
        totalAmount,
        dateTime: dateTime?.trim(),
      };
    } catch (error) {
      logError('Failed to extract check details', error);
      return {};
    }
  }
}