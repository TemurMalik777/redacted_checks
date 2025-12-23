import dotenv from 'dotenv';
import type { StringValue } from 'ms';

// .env faylni yuklash
dotenv.config();

/**
 * Environment variableni olish va validatsiya qilish
 */
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  
  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`❌ Environment variable "${key}" topilmadi!`);
  }
  
  return value;
}

/**
 * Production uchun majburiy environment variableni olish
 */
function getRequiredEnvVar(key: string, devDefault?: string): string {
  const value = process.env[key];
  
  // Development muhitida default qiymat ishlatish mumkin
  if (!value && !isProduction && devDefault) {
    console.warn(`⚠️  Dev muhit: "${key}" default qiymatdan foydalanilmoqda`);
    return devDefault;
  }
  
  // Production yoki qiymat yo'q bo'lsa - xato
  if (!value) {
    throw new Error(
      `❌ CRITICAL: "${key}" environment variable majburiy! .env faylni tekshiring.`
    );
  }
  
  return value;
}

/**
 * Node muhitini aniqlash
 */
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isDevelopment = NODE_ENV === 'development';

/**
 * Environment Configuration
 */
export const config = {
  // Server
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV,
  isDevelopment,
  isProduction,

  // Database - Production'da majburiy
  DB_HOST: getRequiredEnvVar('DB_HOST', 'localhost'),
  DB_PORT: parseInt(getRequiredEnvVar('DB_PORT', '5432'), 10),
  DB_NAME: getRequiredEnvVar('DB_NAME', 'redacted_checks'),
  DB_USER: getRequiredEnvVar('DB_USER', 'postgres'),
  DB_PASSWORD: getRequiredEnvVar('DB_PASSWORD', isDevelopment ? '5432' : undefined),

  // Redis
  REDIS_HOST: getEnvVar('REDIS_HOST', 'localhost'),
  REDIS_PORT: parseInt(getEnvVar('REDIS_PORT', '6379'), 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  REDIS_DB: parseInt(getEnvVar('REDIS_DB', '0'), 10),

  // JWT Secrets - Production'da MAJBURIY, default yo'q!
  JWT_SECRET: getRequiredEnvVar(
    'JWT_SECRET',
    isDevelopment ? 'dev_jwt_secret_DO_NOT_USE_IN_PRODUCTION' : undefined
  ),
  JWT_EXPIRE: (process.env.JWT_EXPIRES_IN || '1d') as StringValue,

  // Access Token - Production'da MAJBURIY
  ACCESS_TOKEN_SECRET: getRequiredEnvVar(
    'ACCESS_TOKEN_SECRET',
    isDevelopment ? 'dev_access_token_DO_NOT_USE_IN_PRODUCTION' : undefined
  ),
  ACCESS_TOKEN_EXPIRES_IN: (process.env.ACCESS_TOKEN_EXPIRES_IN || '1d') as StringValue,

  // Refresh Token - Production'da MAJBURIY
  REFRESH_TOKEN_SECRET: getRequiredEnvVar(
    'REFRESH_TOKEN_SECRET',
    isDevelopment ? 'dev_refresh_token_DO_NOT_USE_IN_PRODUCTION' : undefined
  ),
  REFRESH_TOKEN_EXPIRES_IN: (process.env.REFRESH_TOKEN_EXPIRES_IN || '7d') as StringValue,

  // API Keys
  API_KEY: process.env.API_KEY || '',
  CAPTCHA_SOLVER_API_KEY: getRequiredEnvVar(
    'CAPTCHA_SOLVER_API_KEY',
    isDevelopment ? '' : undefined
  ),

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || 'logs/application.log',

  // File Upload
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',

  // Browser Automation
  HEADLESS: process.env.HEADLESS !== 'false', // Default: true
  BROWSER_TIMEOUT: parseInt(process.env.BROWSER_TIMEOUT || '30000', 10),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
};

/**
 * Production uchun qo'shimcha validatsiya
 */
if (isProduction) {
  console.log('🔒 Production muhit aniqlandi - xavfsizlik tekshiruvlari...');
  
  // Secret uzunligini tekshirish
  const secrets = {
    JWT_SECRET: config.JWT_SECRET,
    ACCESS_TOKEN_SECRET: config.ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET: config.REFRESH_TOKEN_SECRET,
  };

  Object.entries(secrets).forEach(([key, value]) => {
    if (value.length < 32) {
      console.error(
        `❌ XAVFSIZLIK XATOSI: ${key} juda qisqa! Minimum 32 belgi tavsiya etiladi.`
      );
      console.error(`   Hozirgi uzunlik: ${value.length} belgi`);
      process.exit(1);
    }
    
    // Development default qiymatlarini tekshirish
    if (value.includes('DO_NOT_USE_IN_PRODUCTION')) {
      console.error(
        `❌ CRITICAL: ${key} development default qiymatidan foydalanilmoqda!`
      );
      console.error(`   Production uchun xavfsiz secret o'rnating!`);
      process.exit(1);
    }
  });

  // Database password tekshirish
  if (!config.DB_PASSWORD || config.DB_PASSWORD.length < 8) {
    console.error('❌ XAVFSIZLIK: DB_PASSWORD juda zaif yoki yo\'q!');
    process.exit(1);
  }

  // CAPTCHA API key tekshirish
  if (!config.CAPTCHA_SOLVER_API_KEY) {
    console.error('❌ Production: CAPTCHA_SOLVER_API_KEY majburiy!');
    process.exit(1);
  }

  console.log('✅ Barcha xavfsizlik tekshiruvlari muvaffaqiyatli o\'tdi');
}

/**
 * Development muhit uchun ogohlantirish
 */
if (isDevelopment) {
  console.log('🛠️  Development muhit - default qiymatlar ishlatilmoqda');
  
  const devDefaults = [
    'JWT_SECRET',
    'ACCESS_TOKEN_SECRET', 
    'REFRESH_TOKEN_SECRET'
  ].filter(key => {
    const value = config[key as keyof typeof config];
    return typeof value === 'string' && value.includes('DO_NOT_USE_IN_PRODUCTION');
  });

  if (devDefaults.length > 0) {
    console.log(
      `⚠️  Quyidagi o'zgaruvchilar development default qiymatlarida:\n   ${devDefaults.join(', ')}`
    );
    console.log('   Production uchun .env faylda o\'rnating!\n');
  }
}

/**
 * Config ni console'ga chiqarish (maxfiy ma'lumotlarsiz)
 */
export function logConfig() {
  const safeConfig = {
    ...config,
    DB_PASSWORD: config.DB_PASSWORD ? '***' : 'NOT_SET',
    JWT_SECRET: config.JWT_SECRET ? `${config.JWT_SECRET.substring(0, 4)}***` : 'NOT_SET',
    ACCESS_TOKEN_SECRET: config.ACCESS_TOKEN_SECRET 
      ? `${config.ACCESS_TOKEN_SECRET.substring(0, 4)}***` 
      : 'NOT_SET',
    REFRESH_TOKEN_SECRET: config.REFRESH_TOKEN_SECRET 
      ? `${config.REFRESH_TOKEN_SECRET.substring(0, 4)}***` 
      : 'NOT_SET',
    CAPTCHA_SOLVER_API_KEY: config.CAPTCHA_SOLVER_API_KEY 
      ? `${config.CAPTCHA_SOLVER_API_KEY.substring(0, 4)}***` 
      : 'NOT_SET',
    API_KEY: config.API_KEY ? `${config.API_KEY.substring(0, 4)}***` : 'NOT_SET',
  };

  console.log('📋 Configuration:', JSON.stringify(safeConfig, null, 2));
}

export default config;