// src/database/index.ts
import { sequelize, testConnection } from './connection';
import { migrator } from './migrator';
import config from '../../config/env';

/**
 * Initialize database and run migrations
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    // 1. Test connection
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }

    // 2. Sync models (faqat yangi jadvallar uchun)
    // ❌ ESKI: await sequelize.sync({ alter: true });
    // ✅ YANGI: Faqat jadval yaratish, o'zgartirish emas
    if (config.isDevelopment) {
      console.log('🔄 Syncing database models...');
      await sequelize.sync({ force: false }); // faqat yo'q jadvallarni yaratish
      console.log('✅ Models synced');
    }

    // 3. Run migrations
    console.log('🔄 Running database migrations...');
    const pending = await migrator.pending();
    
    if (pending.length > 0) {
      console.log(`📋 Found ${pending.length} pending migrations`);
      await migrator.up();
      console.log('✅ All migrations completed');
    } else {
      console.log('✅ Database is up to date');
    }

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

// Export sequelize instance
export { sequelize };
export default sequelize;