import { Page } from 'playwright';
import fs from 'fs/promises';

export class AutomationHelpers {
  /**
   * Element ko'rinishini kutish
   */
  static async waitForElement(
    page: Page, 
    selector: string, 
    timeout: number = 10000
  ): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { timeout, state: 'visible' });
      return true;
    } catch {
      console.error(`❌ Element not found: ${selector}`);
      return false;
    }
  }

  /**
   * Xavfsiz click (element ko'ringuncha kutadi)
   */
  static async safeClick(page: Page, selector: string): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { state: 'visible' });
      await page.click(selector);
      return true;
    } catch (error) {
      console.error(`❌ Click failed for: ${selector}`, error);
      return false;
    }
  }

  /**
   * Xavfsiz fill (input ko'ringuncha kutadi)
   */
  static async safeFill(page: Page, selector: string, value: string): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { state: 'visible' });
      await page.fill(selector, value);
      return true;
    } catch (error) {
      console.error(`❌ Fill failed for: ${selector}`, error);
      return false;
    }
  }

  /**
   * Random delay (bot detection oldini olish)
   */
  static async randomDelay(min: number = 500, max: number = 1500): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Element mavjudligini tekshirish
   */
  static async elementExists(page: Page, selector: string): Promise<boolean> {
    try {
      const element = await page.$(selector);
      return element !== null;
    } catch {
      return false;
    }
  }

  /**
   * Text olish
   */
  static async getText(page: Page, selector: string): Promise<string | null> {
    try {
      const element = await page.$(selector);
      return element ? await element.textContent() : null;
    } catch {
      return null;
    }
  }

  /**
   * CAPTCHA rasmni saqlash
   */
  static async saveCaptchaImage(page: Page, selector: string, filename: string): Promise<string> {
    const element = await page.$(selector);
    if (!element) throw new Error('CAPTCHA image not found');

    const screenshotPath = `captchas/${filename}-${Date.now()}.png`;
    await element.screenshot({ path: screenshotPath });
    
    return screenshotPath;
  }

  /**
   * Retry with exponential backoff
   */
  static async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        
        const waitTime = delayMs * Math.pow(2, i);
        console.log(`⏳ Retry ${i + 1}/${maxRetries} after ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    throw new Error('Max retries exceeded');
  }
}