import { BrowserManager } from './utils/browserManager';
import { LoginAction, LoginCredentials } from './actions/loginAction';
import { InvoiceAction, InvoiceData } from './actions/invoiceAction';
import { Page } from 'playwright';

/**
 * Tax Site Service
 */
export class TaxSiteService {
  private browserManager: BrowserManager;
  private page: Page | null = null;
  private readonly baseUrl: string;

  constructor() {
    this.browserManager = new BrowserManager();
    this.baseUrl = process.env.TAX_SITE_URL || 'https://my3.soliq.uz/';
  }

  async initialize(headless: boolean = false): Promise<void> {
    console.log('🚀 Initializing Tax Site Service...');
    this.page = await this.browserManager.initialize(headless);
    await this.page.goto(this.baseUrl);
    console.log(`✅ Navigated to ${this.baseUrl}`);
  }

  async login(credentials: LoginCredentials): Promise<boolean> {
    if (!this.page) {
      await this.initialize();
    }

    console.log('🔐 Attempting login...');
    const loginAction = new LoginAction(this.page!);
    const success = await loginAction.execute(credentials);

    if (success) {
      console.log('✅ Login successful');
    } else {
      console.error('❌ Login failed');
    }

    return success;
  }

  async createInvoice(data: InvoiceData): Promise<boolean> {
    if (!this.page) {
      throw new Error('Not initialized. Call initialize() or login() first.');
    }

    console.log('📄 Creating invoice...');
    const invoiceAction = new InvoiceAction(this.page);
    const success = await invoiceAction.execute(data);

    if (success) {
      console.log('✅ Invoice created successfully');
    } else {
      console.error('❌ Invoice creation failed');
    }

    return success;
  }

  async logout(): Promise<void> {
    if (!this.page) return;

    try {
      console.log('👋 Logging out...');
      const logoutButton = 'button.logout';
      await this.page.click(logoutButton);
      await this.page.waitForLoadState('networkidle');
      console.log('✅ Logged out successfully');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  }

  async close(): Promise<void> {
    console.log('🔒 Closing browser...');
    await this.browserManager.close();
    console.log('✅ Browser closed');
  }

  async clearSession(): Promise<void> {
    console.log('🗑️ Clearing session...');
    await this.browserManager.clearSession();
    console.log('✅ Session cleared');
  }

  getPage(): Page | null {
    return this.page;
  }

  /**
   * ✅ Bu metod qo'shildi!
   */
  async isLoggedIn(): Promise<boolean> {
    if (!this.page) {
      return false;
    }

    try {
      const loginAction = new LoginAction(this.page);
      return await loginAction.checkLoginStatus();
    } catch (error) {
      console.error('❌ Login status check error:', error);
      return false;
    }
  }
}
