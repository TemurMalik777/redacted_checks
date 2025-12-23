import { redis } from '../config/redis';
import { SessionData, SessionStoreOptions } from '../types/session.types';

/**
 * Redis-based session store
 * Barcha automation sessionlarni boshqaradi
 */
export class SessionStore {
  private prefix: string;
  private defaultTTL: number;

  constructor(options: SessionStoreOptions = {}) {
    this.prefix = options.prefix || 'automation:session:';
    this.defaultTTL = options.ttl || 3600; // 1 soat
  }

  /**
   * Session key yaratish
   */
  private getKey(userId: number | string): string {
    return `${this.prefix}${userId}`;
  }

  /**
   * Sessionni saqlash
   */
  async set(userId: number, data: SessionData, ttl?: number): Promise<void> {
    const key = this.getKey(userId);
    const value = JSON.stringify(data);
    const expiry = ttl || this.defaultTTL;

    await redis.setex(key, expiry, value);
  }

  /**
   * Sessionni olish
   */
  async get(userId: number): Promise<SessionData | null> {
    const key = this.getKey(userId);
    const data = await redis.get(key);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as SessionData;
    } catch (error) {
      console.error('Session parse error:', error);
      return null;
    }
  }

  /**
   * Sessionni yangilash (partial update)
   */
  async update(userId: number, updates: Partial<SessionData>): Promise<void> {
    const existing = await this.get(userId);
    
    if (!existing) {
      throw new Error('Session topilmadi');
    }

    const updated = { ...existing, ...updates };
    await this.set(userId, updated);
  }

  /**
   * Session mavjudligini tekshirish
   */
  async exists(userId: number): Promise<boolean> {
    const key = this.getKey(userId);
    const result = await redis.exists(key);
    return result === 1;
  }

  /**
   * Sessionni o'chirish
   */
  async delete(userId: number): Promise<void> {
    const key = this.getKey(userId);
    await redis.del(key);
  }

  /**
   * Session TTL ni yangilash
   */
  async refresh(userId: number, ttl?: number): Promise<void> {
    const key = this.getKey(userId);
    const expiry = ttl || this.defaultTTL;
    await redis.expire(key, expiry);
  }

  /**
   * Session TTL ni olish (qancha vaqt qolgan)
   */
  async getTTL(userId: number): Promise<number> {
    const key = this.getKey(userId);
    return await redis.ttl(key);
  }

  /**
   * Barcha active sessionlarni olish
   */
  async getAllActiveSessions(): Promise<Array<{ userId: string; data: SessionData }>> {
    const pattern = `${this.prefix}*`;
    const keys = await redis.keys(pattern);

    const sessions = await Promise.all(
      keys.map(async (key) => {
        const data = await redis.get(key);
        const userId = key.replace(this.prefix, '');
        
        return {
          userId,
          data: data ? JSON.parse(data) : null,
        };
      })
    );

    return sessions.filter((s) => s.data !== null);
  }

  /**
   * Barcha sessionlarni o'chirish (cleanup)
   */
  async clear(): Promise<void> {
    const pattern = `${this.prefix}*`;
    const keys = await redis.keys(pattern);

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

/**
 * Singleton instance
 */
export const sessionStore = new SessionStore({
  prefix: 'automation:session:',
  ttl: 3600, // 1 soat
});