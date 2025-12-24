import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs/promises';

export class BrowserManager {
  private browser: BrowserContext | null = null; // ✔ to‘g‘riladi
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private readonly userDataDir: string;

  constructor() {
    this.userDataDir = path.join(process.cwd(), 'browser-data');
  }

  async initialize(headless: boolean = false): Promise<Page> {
    try {
      await fs.mkdir(this.userDataDir, { recursive: true });

      // ❗ Bu Browser emas, BrowserContext qaytaradi
      this.browser = await chromium.launchPersistentContext(this.userDataDir, {
        headless,
        viewport: null, // native window size
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--start-maximized',
        ],
        // ...
      });

      this.context = this.browser; // ✔ endi xato chiqmaydi

      const pages = this.context.pages();
      this.page = pages.length > 0 ? pages[0] : await this.context.newPage();

      await this.setupAntiDetection();
      return this.page;
    } catch (error) {
      console.error('Browser initialization error:', error);
      throw error;
    }
  }

  private async setupAntiDetection(): Promise<void> {
    if (!this.page) return;

    // WebDriver property ni o'chirish
    await this.page.addInitScript(() => {
      // @ts-ignore - Browser contextida ishlaydi
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
  }

  async getPage(): Promise<Page> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    return this.page;
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
      this.browser = null;
    }
  }

  async clearSession(): Promise<void> {
    await this.close();
    try {
      await fs.rm(this.userDataDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }
}
