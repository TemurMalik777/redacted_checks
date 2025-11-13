import { Sequelize, Options } from 'sequelize';
import { config } from './env';

/**
 * Sequelize konfiguratsiya opsiyalari
 * 
 * IZOH: Bu yerda PostgreSQL ga ulanish parametrlari berilgan.
 * - dialect: 'postgres' - PostgreSQL ishlatamiz
 * - logging: development da SQL querylarni ko'rsatadi
 * - pool: connection pool sozlamalari (ko'p requestlar uchun muhim)
 */
const sequelizeOptions: Options = {
  dialect: 'postgres',
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  username: config.DB_USER,
  password: config.DB_PASSWORD,
  
  // Logging - development da SQL querylarni console ga chiqaradi
  logging: config.isDevelopment ? console.log : false,
  
  /**
   * Connection Pool sozlamalari
   * 
   * Pool - bu bir nechta database connectionlarni qayta ishlatish
   * Har safar yangi connection ochish o'rniga, mavjudlaridan foydalanadi
   * Bu juda tez ishlashni ta'minlaydi!
   */
  pool: {
    max: 10,        // Maksimal 10 ta ulanish
    min: 2,         // Minimal 2 ta ulanish doim ochiq turadi
    acquire: 30000, // 30 soniya - yangi connection olish uchun kutish vaqti
    idle: 10000,    // 10 soniya - connection ishlatilmasa, yopiladi
  },
  
  /**
   * Timezone sozlamalari
   * UTC da ishlash - xalqaro standart
   */
  timezone: '+00:00',
  
  /**
   * Query options
   */
  define: {
    timestamps: true,      // createdAt va updatedAt avtomatik qo'shiladi
    underscored: false,    // camelCase ishlatamiz (snake_case emas)
    freezeTableName: true, // Jadval nomini ko'plik shaklga o'zgartirmaslik
  },
};

/**
 * Sequelize instanceni yaratish
 * Bu instance barcha database operatsiyalar uchun ishlatiladi
 */
export const sequelize = new Sequelize(sequelizeOptions);

/**
 * Database ulanishni tekshirish funktsiyasi
 * 
 * Bu funktsiya server start bo'lganda chaqiriladi
 * Agar DB ga ulanish muvaffaqiyatsiz bo'lsa, dastur to'xtaydi
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    // Ulanishni sinab ko'rish
    await sequelize.authenticate();
    
    console.log('✅ PostgreSQL ulanishi muvaffaqiyatli!');
    console.log(`📊 Database: ${config.DB_NAME}`);
    console.log(`🖥️  Host: ${config.DB_HOST}:${config.DB_PORT}`);
    
    /**
     * Development rejimida jadvallarni sync qilish
     * 
     * DIQQAT: Production da sync() ishlatmang!
     * Production da migration ishlatish kerak
     * 
     * alter: true - mavjud jadvallarni o'zgartiradi (ustunlar qo'shadi/o'chiradi)
     * force: false - jadvallarni o'chirmaslik (true bo'lsa, barcha ma'lumot o'chadi!)
     */
    if (config.isDevelopment) {
      await sequelize.sync({ alter: true });
      console.log('📝 Database jadvallar sync qilindi (alter mode)');
    }
    
  } catch (error) {
    console.error('❌ Database ulanish xatosi:', error);
    console.error('');
    console.error('Iltimos tekshiring:');
    console.error('1. PostgreSQL ishlab turibmi?');
    console.error('2. .env fayl to\'g\'ri to\'ldirilganmi?');
    console.error('3. Database yaratilganmi?');
    console.error(`   Buyruq: createdb ${config.DB_NAME}`);
    
    // Dasturni to'xtatish
    process.exit(1);
  }
};

/**
 * Database ulanishni to'g'ri yopish
 * Server to'xtaganda chaqiriladi
 */
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await sequelize.close();
    console.log('👋 Database ulanishi yopildi');
  } catch (error) {
    console.error('❌ Database yopish xatosi:', error);
  }
};

export default sequelize;