// src/utils/migration-logger.ts
import logger from './logger';

export const migrationLogger = {
  start: (name: string) => {
    logger.info(`▶️  Migration boshlandi: ${name}`);
  },

  success: (name: string) => {
    logger.info(`✅ Migration muvaffaqiyatli: ${name}`);
  },

  error: (name: string, error: Error) => {
    logger.error(`❌ Migration xatosi: ${name}`, {
      error: error.message,
      stack: error.stack,
    });
  },

  pending: (count: number) => {
    logger.warn(`⏳ ${count} ta yangi migration kutilmoqda`);
  },

  info: (message: string, meta?: any) => {
    logger.info(`ℹ️  ${message}`, meta);
  },
};
