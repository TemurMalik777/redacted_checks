import { TaxSiteService } from '../../automation/taxSiteSelectors';
import { sessionStore } from '../../services/sessionStore';
import { SessionStatus, SessionData } from '../../types/session.types';

/**
 * Automation Service
 * Business logic va session management
 */
export class AutomationService {
  /**
   * Helper: Session data yaratish
   */
  private createSessionData(
    userId: number,
    status: SessionStatus = SessionStatus.IDLE
  ): SessionData {
    return {
      userId,
      status,
      startedAt: new Date().toISOString(),
      progress: 0,
      metadata: {
        checksProcessed: 0,
        checksTotal: 0,
        lastActivity: new Date().toISOString(),
      },
    };
  }

  /**
   * Browser va session initialize
   */
  async initializeBrowser(
    userId: number,
    headless: boolean = true
  ): Promise<{ success: boolean; sessionId: number; headless: boolean }> {
    try {
      // Session yaratish
      const sessionData = this.createSessionData(userId, SessionStatus.IDLE);
      await sessionStore.set(userId, sessionData);

      // Browser initialize
      const taxService = new TaxSiteService();
      await taxService.initialize(headless);

      // Session yangilash
      await sessionStore.update(userId, {
        status: SessionStatus.IDLE,
        metadata: {
          ...sessionData.metadata,
          browserInitialized: true,
          lastActivity: new Date().toISOString(),
        },
      });

      return {
        success: true,
        sessionId: userId,
        headless,
      };
    } catch (error) {
      // Xato bo'lsa sessionni tozalash
      await sessionStore.delete(userId);
      throw error;
    }
  }

  /**
   * Tax site ga login
   */
  async login(
    userId: number,
    tin: string,
    password: string,
    captcha?: string
  ): Promise<{ success: boolean; message: string }> {
    const taxService = new TaxSiteService();

    try {
      const session = await sessionStore.get(userId);
      if (!session) {
        throw new Error('Session topilmadi');
      }

      // Session statusini "running" ga o'zgartirish
      await sessionStore.update(userId, {
        status: SessionStatus.RUNNING,
        currentStep: 'login',
        metadata: {
          ...session.metadata,
          lastActivity: new Date().toISOString(),
        },
      });

      // Browser initialize (agar qilinmagan bo'lsa)
      const isLoggedIn = await taxService.isLoggedIn();
      if (!isLoggedIn) {
        await taxService.initialize(false);
      }

      // Login
      const success = await taxService.login({ tin, password, captcha });

      if (success) {
        await sessionStore.update(userId, {
          status: SessionStatus.IDLE,
          currentStep: 'logged_in',
          metadata: {
            ...session.metadata,
            loggedIn: true,
            tin,
            lastActivity: new Date().toISOString(),
          },
        });

        return {
          success: true,
          message: 'Login muvaffaqiyatli',
        };
      } else {
        await sessionStore.update(userId, {
          status: SessionStatus.FAILED,
          currentStep: 'login_failed',
          errorMessage: 'Login muvaffaqiyatsiz',
        });

        return {
          success: false,
          message: 'Login muvaffaqiyatsiz',
        };
      }
    } finally {
      await taxService.close();
    }
  }

  /**
   * Invoice yaratish
   */
  async createInvoice(
    userId: number,
    invoiceData: any
  ): Promise<{ success: boolean; message: string }> {
    const taxService = new TaxSiteService();

    try {
      const session = await sessionStore.get(userId);
      if (!session) {
        throw new Error('Session topilmadi');
      }

      // Login tekshirish
      if (!session.metadata?.loggedIn) {
        throw new Error('Iltimos avval login qiling');
      }

      // Status yangilash
      await sessionStore.update(userId, {
        status: SessionStatus.RUNNING,
        currentStep: 'creating_invoice',
      });

      const success = await taxService.createInvoice(invoiceData);

      if (success) {
        const processed = (session.metadata?.checksProcessed || 0) + 1;

        await sessionStore.update(userId, {
          status: SessionStatus.IDLE,
          currentStep: 'invoice_created',
          progress: session.metadata?.checksTotal
            ? Math.round((processed / session.metadata.checksTotal) * 100)
            : 0,
          metadata: {
            ...session.metadata,
            checksProcessed: processed,
            lastActivity: new Date().toISOString(),
          },
        });

        return {
          success: true,
          message: 'Invoice muvaffaqiyatli yaratildi',
        };
      } else {
        await sessionStore.update(userId, {
          status: SessionStatus.FAILED,
          errorMessage: 'Invoice yaratish muvaffaqiyatsiz',
        });

        return {
          success: false,
          message: 'Invoice yaratish xatosi',
        };
      }
    } finally {
      await taxService.close();
    }
  }

  /**
   * Logout
   */
  async logout(userId: number): Promise<{ success: boolean; message: string }> {
    const taxService = new TaxSiteService();

    try {
      const session = await sessionStore.get(userId);
      if (!session) {
        throw new Error('Session topilmadi');
      }

      await taxService.logout();

      await sessionStore.update(userId, {
        status: SessionStatus.IDLE,
        currentStep: 'logged_out',
        metadata: {
          ...session.metadata,
          loggedIn: false,
          lastActivity: new Date().toISOString(),
        },
      });

      return {
        success: true,
        message: 'Logout muvaffaqiyatli',
      };
    } finally {
      await taxService.close();
    }
  }

  /**
   * Session va browserni yopish
   */
  async closeSession(userId: number): Promise<void> {
    await sessionStore.delete(userId);
  }

  /**
   * Session statusini olish
   */
  async getSessionStatus(userId: number): Promise<{
    hasSession: boolean;
    session?: SessionData;
    ttl?: number;
    expiresIn?: string;
  }> {
    const session = await sessionStore.get(userId);

    if (!session) {
      return {
        hasSession: false,
      };
    }

    const ttl = await sessionStore.getTTL(userId);

    return {
      hasSession: true,
      session,
      ttl: ttl > 0 ? ttl : 0,
      expiresIn: ttl > 0 ? `${Math.floor(ttl / 60)} daqiqa` : 'Muddati tugagan',
    };
  }

  /**
   * Barcha sessionlarni olish
   */
  async getAllSessions(): Promise<Array<{ userId: string; data: SessionData }>> {
    return await sessionStore.getAllActiveSessions();
  }

  /**
   * Session TTL ni yangilash
   */
  async refreshSession(userId: number): Promise<void> {
    await sessionStore.refresh(userId);
  }
}

export const automationService = new AutomationService();