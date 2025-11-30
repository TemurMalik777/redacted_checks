import { Page } from 'playwright';
import { LOGIN_SELECTORS } from '../utils/selectors';
import { AutomationHelpers } from '../utils/helper';

export interface LoginCredentials {
  tin: string;
  password: string;
  captcha?: string; // Manual yoki service orqali
}

export class LoginAction {
  constructor(private page: Page) {}

  async execute(credentials: LoginCredentials): Promise<boolean> {
    try {
      console.log('🔐 Starting login process...');

      // TIN kiriting
      const tinFilled = await AutomationHelpers.safeFill(
        this.page,
        LOGIN_SELECTORS.tinInput,
        credentials.tin
      );
      if (!tinFilled) throw new Error('Failed to fill TIN');

      await AutomationHelpers.randomDelay();

      // Parol kiriting
      const passwordFilled = await AutomationHelpers.safeFill(
        this.page,
        LOGIN_SELECTORS.passwordInput,
        credentials.password
      );
      if (!passwordFilled) throw new Error('Failed to fill password');

      await AutomationHelpers.randomDelay();

      // CAPTCHA bor mi?
      const hasCaptcha = await AutomationHelpers.elementExists(
        this.page,
        LOGIN_SELECTORS.captchaImage
      );

      if (hasCaptcha) {
        console.log('🖼️  CAPTCHA detected');
        
        if (credentials.captcha) {
          // CAPTCHA kodi berilgan bo'lsa
          await AutomationHelpers.safeFill(
            this.page,
            LOGIN_SELECTORS.captchaInput,
            credentials.captcha
          );
        } else {
          // Manual solving uchun kutish
          console.log('⏳ Please solve CAPTCHA manually...');
          await this.page.waitForTimeout(60000); // 1 daqiqa kutish
        }
      }

      // Login tugmasini bosish
      const loginClicked = await AutomationHelpers.safeClick(
        this.page,
        LOGIN_SELECTORS.loginButton
      );
      if (!loginClicked) throw new Error('Failed to click login button');

      // Dashboard yuklanishini kutish
      await this.page.waitForLoadState('networkidle');

      // Login muvaffaqiyatli bo'lganini tekshirish
      const isLoggedIn = await AutomationHelpers.elementExists(
        this.page,
        LOGIN_SELECTORS.dashboardContainer
      );

      if (isLoggedIn) {
        console.log('✅ Login successful');
        return true;
      } else {
        // Xato xabarini tekshirish
        const errorMsg = await AutomationHelpers.getText(
          this.page,
          LOGIN_SELECTORS.errorMessage
        );
        console.error('❌ Login failed:', errorMsg);
        return false;
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      return false;
    }
  }

  async checkLoginStatus(): Promise<boolean> {
    return await AutomationHelpers.elementExists(
      this.page,
      LOGIN_SELECTORS.dashboardContainer
    );
  }
}