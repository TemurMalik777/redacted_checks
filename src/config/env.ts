import dotenv from 'dotenv';
import path from 'path';

// .env faylini yuklash
dotenv.config();

/**
 * Environment o'zgaruvchilarini validation qilish va type-safe qilish
 */
class Config {
  // Server
  readonly PORT: number;
  readonly NODE_ENV: string;

  // Database
  readonly DB_HOST: string;
  readonly DB_PORT: number;
  readonly DB_NAME: string;
  readonly DB_USER: string;
  readonly DB_PASSWORD: string;
  readonly DATABASE_URL: string;

  // JWT
  readonly JWT_SECRET: string;
  readonly JWT_EXPIRE: string;

  // API Keys
  readonly CAPTCHA_API_KEY: string;

  // Logging
  readonly LOG_LEVEL: string;
  readonly LOG_FILE: string;

  // File Upload
  readonly MAX_FILE_SIZE: number;
  readonly UPLOAD_PATH: string;

  // Browser Automation
  readonly BROWSER_HEADLESS: boolean;
  readonly BROWSER_TIMEOUT: number;

  // Target Website
  readonly TARGET_URL: string;

  constructor() {
    // Server
    this.PORT = parseInt(process.env.PORT || '3001', 10);
    this.NODE_ENV = process.env.NODE_ENV || 'development';

    // Database
    this.DB_HOST = process.env.DB_HOST || 'localhost';
    this.DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
    this.DB_NAME = process.env.DB_NAME || 'redacted_checks';
    this.DB_USER = process.env.DB_USER || 'postgres';
    this.DB_PASSWORD = process.env.DB_PASSWORD || '5432';
    
    // Database URL yaratish
    this.DATABASE_URL = process.env.DATABASE_URL || 
      `postgresql://${this.DB_USER}:${this.DB_PASSWORD}@${this.DB_HOST}:${this.DB_PORT}/${this.DB_NAME}`;

    // JWT
    this.JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key';
    this.JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

    // API Keys
    this.CAPTCHA_API_KEY = process.env.CAPTCHA_API_KEY || '';

    // Logging
    this.LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
    this.LOG_FILE = process.env.LOG_FILE || 'logs/app.log';

    // File Upload
    this.MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10); // 10MB default
    this.UPLOAD_PATH = process.env.UPLOAD_PATH || 'uploads';

    // Browser Automation
    this.BROWSER_HEADLESS = process.env.BROWSER_HEADLESS === 'true';
    this.BROWSER_TIMEOUT = parseInt(process.env.BROWSER_TIMEOUT || '30000', 10);

    // Target Website
    this.TARGET_URL = process.env.TARGET_URL || 'https://my3.soliq.uz';

    this.validateConfig();
  }

  /**
   * Muhim config parametrlarini tekshirish
   */
  private validateConfig(): void {
    const requiredVars = [
      'DB_HOST',
      'DB_NAME',
      'DB_USER',
      'JWT_SECRET'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
      console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
      console.warn('Please check your .env file');
    }

    // Production da JWT_SECRET default bo'lmasligi kerak
    if (this.NODE_ENV === 'production' && this.JWT_SECRET === 'default_secret_key') {
      throw new Error('JWT_SECRET must be set in production!');
    }
  }

  /**
   * Config ma'lumotlarini chiroyli ko'rinishda chiqarish (parollarni yashirish)
   */
  public printConfig(): void {
    console.log('=== Configuration ===');
    console.log(`Environment: ${this.NODE_ENV}`);
    console.log(`Server Port: ${this.PORT}`);
    console.log(`Database: ${this.DB_NAME}@${this.DB_HOST}:${this.DB_PORT}`);
    console.log(`Browser Mode: ${this.BROWSER_HEADLESS ? 'Headless' : 'GUI'}`);
    console.log(`Upload Path: ${this.UPLOAD_PATH}`);
    console.log(`Log File: ${this.LOG_FILE}`);
    console.log('===================');
  }

  get isDevelopment(): boolean {
  return this.NODE_ENV === 'development';
}

}

// Singleton pattern - butun app da bitta config instance
export const config = new Config();

// Path utilities
export const paths = {
  root: path.resolve(__dirname, '../..'),
  uploads: path.resolve(__dirname, '../..', config.UPLOAD_PATH),
  logs: path.resolve(__dirname, '../..', 'logs'),
  captchas: path.resolve(__dirname, '../..', 'uploads', 'captchas')
};