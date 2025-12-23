// src/database/database/connection.ts
import { Sequelize } from 'sequelize';
import config from '../../config/env';

/**
 * Sequelize instance
 */
export const sequelize = new Sequelize({
  database: config.DB_NAME,
  username: config.DB_USER,
  password: config.DB_PASSWORD,
  host: config.DB_HOST,
  port: config.DB_PORT,
  dialect: 'postgres',
  logging: config.isDevelopment ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

/**
 * Database connection test
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

/**
 * Database ulanishni to'g'ri yopish
 */
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await sequelize.close();
    console.log('👋 Database ulanishi yopildi');
  } catch (error) {
    console.error('❌ Database yopish xatosi:', error);
  }
};