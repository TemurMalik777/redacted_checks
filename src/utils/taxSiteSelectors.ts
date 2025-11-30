import { BrowserManager } from '../automation/utils/browserManager';
import {
  LoginAction,
  LoginCredentials,
} from '../automation/actions/loginAction';
import {
  InvoiceAction,
  InvoiceData,
} from '../automation/actions/invoiceAction';
import { Page } from 'playwright';

export class TaxSiteService {
  private browserManager: BrowserManager;
  private page: Page | null = null;
  private readonly baseUrl: string;

  constructor(userType: 'admin' | 'user' = 'user') {
    this.browserManager = new BrowserManager(userType);
    this.baseUrl = process.env.TAX_SITE_URL || 'https://my.soliq.uz';
  }

  async initialize(headless: boolean = false): Promise<void> {
    this.page = await this.browserManager.initialize(headless);
    await this.page.goto(this.baseUrl);
  }

  async login(credentials: LoginCredentials): Promise<boolean> {
    if (!this.page) {
      await this.initialize();
    }

    const loginAction = new LoginAction(this.page!);
    const success = await loginAction.execute(credentials);

    if (success) {
      await this.browserManager.saveCookies();
    }

    return success;
  }

  async createInvoice(data: InvoiceData): Promise<boolean> {
    if (!this.page) {
      throw new Error('Not initialized. Call initialize() or login() first.');
    }

    const invoiceAction = new InvoiceAction(this.page);
    const success = await invoiceAction.execute(data);

    // Screenshot olish (muvaffaqiyatli yoki xato)
    const screenshotName = success ? 'invoice-success' : 'invoice-error';
    await this.browserManager.takeScreenshot(screenshotName);

    return success;
  }

  async logout(): Promise<void> {
    if (!this.page) return;

    try {
      const logoutButton = 'button.logout';
      await this.page.click(logoutButton);
      await this.page.waitForLoadState('networkidle');
      console.log('✅ Logged out successfully');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  }

  async close(): Promise<void> {
    await this.browserManager.close();
  }

  async clearSession(): Promise<void> {
    await this.browserManager.clearSession();
  }

  getPage(): Page | null {
    return this.page;
  }
}
