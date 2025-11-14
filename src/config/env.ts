import dotenv from 'dotenv';
import type { StringValue } from 'ms';

// .env faylni yuklash
dotenv.config();

/**
 * Environment Configuration
 */
export const config = {
  // Server
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Database
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_NAME: process.env.DB_NAME || 'redacted_checks',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || '5432',

  // JWT - Access Token
  JWT_SECRET: process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET || 'super_secret_change_this',
  JWT_EXPIRE: (process.env.JWT_EXPIRES_IN || process.env.ACCESS_TOKEN_EXPIRES_IN || '15m') as StringValue,

  // Access Token
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || 'access_token_secret_change_this',
  ACCESS_TOKEN_EXPIRES_IN: (process.env.ACCESS_TOKEN_EXPIRES_IN || '15m') as StringValue,

  // Refresh Token
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'refresh_token_secret_change_this',
  REFRESH_TOKEN_EXPIRES_IN: (process.env.REFRESH_TOKEN_EXPIRES_IN || '7d') as StringValue,

  // API Keys
  API_KEY: process.env.API_KEY || '',
  CAPTCHA_SOLVER_API_KEY: process.env.CAPTCHA_SOLVER_API_KEY || 'b5f4362e7f0c752d0ff8d2ce1726e16e',

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || 'logs/application.log',

  // File Upload
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',

  // Browser Automation
  HEADLESS: process.env.HEADLESS === 'true',
  BROWSER_TIMEOUT: parseInt(process.env.BROWSER_TIMEOUT || '30000', 10),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
};

/**
 * Majburiy environment variablelarni tekshirish
 */
const requiredEnvVars = ['DB_NAME', 'DB_USER'];

const missingEnvVars = requiredEnvVars.filter(
  (envVar) => !process.env[envVar]
);

if (missingEnvVars.length > 0) {
  console.error(
    `❌ Quyidagi environment variablelar topilmadi: ${missingEnvVars.join(', ')}`
  );
  console.error('   .env faylni tekshiring!');
}

/**
 * Production uchun ogohlantirish
 */
if (config.isProduction) {
  if (config.JWT_SECRET === 'super_secret_change_this') {
    console.warn('⚠️  WARNING: JWT_SECRET default qiymatda! O\'zgartiring!');
  }

  if (config.ACCESS_TOKEN_SECRET === 'access_token_secret_change_this') {
    console.warn('⚠️  WARNING: ACCESS_TOKEN_SECRET default qiymatda! O\'zgartiring!');
  }

  if (config.REFRESH_TOKEN_SECRET === 'refresh_token_secret_change_this') {
    console.warn('⚠️  WARNING: REFRESH_TOKEN_SECRET default qiymatda! O\'zgartiring!');
  }
}

export default config;