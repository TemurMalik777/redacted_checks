// src/automation/actions/fiscalModalAction.ts

import { Page } from 'playwright';
import { CHECK_SEARCH_SELECTORS } from '../utils/selectors';
import { AutomationHelpers } from '../utils/helper';
import { logInfo, logError, logWarn } from '../utils/logUtils';
import fs from 'fs/promises';
import path from 'path';

const FISCAL_CONFIG_PATH = path.join(process.cwd(), 'config', 'fiscal-module.json');

interface FiscalConfig {
  fiscalModuleValue: string;
  savedAt: string;
}

export class FiscalModalAction {
  /**
   * 🎯 ASOSIY FUNKSIYA: Fiskal modul modalini tekshirish
   */
  static async handleFiscalModal(page: Page): Promise<boolean> {
    try {
      logInfo('🔍 Checking for fiscal module modal...');

      // 1. Modal ochilganmi tekshirish (2-3 sekund kutamiz)
      const modalVisible = await Promise.race([
        page.waitForSelector(CHECK_SEARCH_SELECTORS.activationModal, {
          state: 'visible',
          timeout: 3000,
        }).then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000)),
      ]);

      if (!modalVisible) {
        logInfo('✅ Modal not found - assuming fiscal module is already configured');
        return true;
      }

      // 2. Modal bor - uni yopish kerak
      logWarn('⚠️ Activation modal detected - trying to close...');
      await this.closeModal(page);
      
      // 3. Fiskal modul inputini tekshirish
      await AutomationHelpers.randomDelay(1000, 1500);
      const inputVisible = await AutomationHelpers.elementExists(
        page,
        CHECK_SEARCH_SELECTORS.fiscalModuleInput
      );

      if (!inputVisible) {
        logError('❌ Fiscal module input not found after modal close');
        return false;
      }

      // 4. Saqlangan konfiguratsiya bormi?
      const savedConfig = await this.loadSavedConfig();

      if (savedConfig) {
        logInfo(`✅ Using saved fiscal module: ${savedConfig.fiscalModuleValue}`);
        await this.fillFiscalModule(page, savedConfig.fiscalModuleValue);
        return true;
      }

      // 5. Birinchi marta - foydalanuvchidan kutish
      logWarn('⏸️ FIRST TIME SETUP - Please enter fiscal module manually!');
      console.log('\n' + '='.repeat(70));
      console.log('⚠️  ILTIMOS, FISKAL MODUL RAQAMINI KIRITING!');
      console.log('    Masalan: VG343420041471 - BES-24-43*');
      console.log('    Keyin "Қидириш" tugmasini BOSMANG, faqat kiriting!');
      console.log('='.repeat(70) + '\n');

      // 6. Input'ga yozilishini kutish (30 sekund)
      const fiscalValue = await this.waitForUserInput(page, 30000);

      if (fiscalValue) {
        await this.saveConfig(fiscalValue);
        logInfo(`✅ Fiscal module saved for future use: ${fiscalValue}`);
        return true;
      } else {
        logError('❌ User did not enter fiscal module within 30 seconds');
        return false;
      }
    } catch (error) {
      logError('❌ Fiscal modal handling failed', error);
      return false;
    }
  }

  /**
   * Modal'ni yopish
   */
  private static async closeModal(page: Page): Promise<void> {
    try {
      // Escape tugmasini bosish
      await page.keyboard.press('Escape');
      await AutomationHelpers.randomDelay(500, 800);

      // Yoki close button'ni topish
      const closeButton = await page.$(CHECK_SEARCH_SELECTORS.modalCloseButton);
      if (closeButton) {
        await closeButton.click();
        logInfo('✅ Modal closed via button');
      } else {
        logInfo('✅ Modal closed via Escape key');
      }
    } catch (error) {
      logWarn('⚠️ Could not close modal, continuing anyway...', error);
    }
  }

  /**
   * Fiskal modul inputiga yozish
   */
  private static async fillFiscalModule(page: Page, value: string): Promise<void> {
    try {
      // Inputni topish (asosiy yoki alternative)
      let inputSelector = CHECK_SEARCH_SELECTORS.fiscalModuleInput;
      let inputExists = await AutomationHelpers.elementExists(page, inputSelector);

      if (!inputExists) {
        inputSelector = CHECK_SEARCH_SELECTORS.fiscalModuleInputAlt;
        inputExists = await AutomationHelpers.elementExists(page, inputSelector);
      }

      if (!inputExists) {
        throw new Error('Fiscal module input not found');
      }

      // Clear existing value
      await page.fill(inputSelector, '');
      await AutomationHelpers.randomDelay(200, 400);

      // Enter value with human-like typing
      await page.type(inputSelector, value, { delay: 100 });
      logInfo(`✅ Fiscal module filled: ${value}`);
    } catch (error) {
      logError('❌ Failed to fill fiscal module', error);
      throw error;
    }
  }

  /**
   * Foydalanuvchi input kiritishini kutish
   */
  private static async waitForUserInput(
    page: Page,
    timeoutMs: number
  ): Promise<string | null> {
    const startTime = Date.now();
    let inputSelector = CHECK_SEARCH_SELECTORS.fiscalModuleInput;

    // Alternative inputni tekshirish
    const exists = await AutomationHelpers.elementExists(page, inputSelector);
    if (!exists) {
      inputSelector = CHECK_SEARCH_SELECTORS.fiscalModuleInputAlt;
    }

    while (Date.now() - startTime < timeoutMs) {
      try {
        const value = await page.inputValue(inputSelector);
        
        // Agar 10+ belgi kiritilgan bo'lsa, qabul qilamiz
        if (value && value.trim().length > 10) {
          return value.trim();
        }

        // 1 sekund kutamiz
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        // Input topilmasa, davom etamiz
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return null;
  }

  /**
   * Konfiguratsiyani saqlash
   */
  private static async saveConfig(fiscalModuleValue: string): Promise<void> {
    try {
      const config: FiscalConfig = {
        fiscalModuleValue,
        savedAt: new Date().toISOString(),
      };

      const configDir = path.dirname(FISCAL_CONFIG_PATH);
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(FISCAL_CONFIG_PATH, JSON.stringify(config, null, 2));
      
      logInfo(`💾 Config saved to: ${FISCAL_CONFIG_PATH}`);
    } catch (error) {
      logError('❌ Failed to save config', error);
    }
  }

  /**
   * Saqlangan konfiguratsiyani yuklash
   */
  private static async loadSavedConfig(): Promise<FiscalConfig | null> {
    try {
      const data = await fs.readFile(FISCAL_CONFIG_PATH, 'utf-8');
      const config = JSON.parse(data) as FiscalConfig;
      
      logInfo(`📂 Loaded config from: ${FISCAL_CONFIG_PATH}`);
      return config;
    } catch {
      return null;
    }
  }
}