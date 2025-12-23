// scripts/create-migration.ts
import { migrator } from '../src/database/database/migrator';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Yangi migration yaratish
 */
const createMigration = async () => {
  rl.question('📝 Migration nomi kiriting (masalan: add-status-to-checks): ', async (name) => {
    try {
      // Timestamp yaratish
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace('T', 'T')
        .split('.')[0];
      
      const filename = `${timestamp}.${name}.ts`;
      
      // Migration faylni yaratish
      await migrator.create({ name: filename });
      
      console.log(`\n✅ Migration muvaffaqiyatli yaratildi!`);
      console.log(`📁 Fayl: src/database/migrations/${filename}`);
      console.log(`\n💡 Keyingi qadamlar:`);
      console.log(`   1. Migration faylni oching va up/down funksiyalarni yozing`);
      console.log(`   2. npm run migrate:up - migration'ni ishga tushiring\n`);
    } catch (error) {
      console.error('❌ Migration yaratishda xato:', error);
    }
    
    rl.close();
    process.exit(0);
  });
};

createMigration();