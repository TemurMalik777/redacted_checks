// scripts/run-migrations.ts
import { migrator } from '../src/database/database/migrator';
import { sequelize } from '../src/database/database/connection';

/**
 * Migration'larni boshqarish
 */
const runMigrations = async () => {
  const command = process.argv[2];

  try {
    // Database'ga ulanish
    await sequelize.authenticate();
    console.log('✅ Database ga ulandi\n');

    switch (command) {
      case 'up':
        console.log('⬆️  Migrationlarni ishga tushirish...\n');
        const pending = await migrator.pending();
        
        if (pending.length === 0) {
          console.log('✅ Barcha migration\'lar allaqachon bajarilgan');
        } else {
          console.log(`📋 ${pending.length} ta yangi migration topildi:`);
          pending.forEach((m) => console.log(`   - ${m.name}`));
          console.log('');
          
          await migrator.up();
          console.log('✅ Barcha migration\'lar muvaffaqiyatli bajarildi');
        }
        break;

      case 'down':
        console.log('⬇️  Oxirgi migration\'ni bekor qilish...\n');
        const executed = await migrator.executed();
        
        if (executed.length === 0) {
          console.log('⚠️  Bekor qilinadigan migration yo\'q');
        } else {
          const lastMigration = executed[executed.length - 1];
          console.log(`🔄 Bekor qilinayotgan migration: ${lastMigration.name}\n`);
          
          await migrator.down();
          console.log('✅ Migration muvaffaqiyatli bekor qilindi');
        }
        break;

      case 'pending':
        const pendingList = await migrator.pending();
        console.log(`📋 Kutilayotgan migration'lar: ${pendingList.length}\n`);
        
        if (pendingList.length === 0) {
          console.log('✅ Barcha migration\'lar bajarilgan');
        } else {
          pendingList.forEach((m, index) => {
            console.log(`   ${index + 1}. ${m.name}`);
          });
        }
        break;

      case 'executed':
        const executedList = await migrator.executed();
        console.log(`✅ Bajarilgan migration'lar: ${executedList.length}\n`);
        
        if (executedList.length === 0) {
          console.log('⚠️  Hali birorta migration bajarilmagan');
        } else {
          executedList.forEach((m, index) => {
            console.log(`   ${index + 1}. ${m.name}`);
          });
        }
        break;

      case 'reset':
        console.log('🔄 Barcha migration\'larni bekor qilish...\n');
        await migrator.down({ to: 0 as any });
        console.log('✅ Barcha migration\'lar bekor qilindi');
        break;

      default:
        console.log('❌ Noto\'g\'ri buyruq!\n');
        console.log('Foydalanish:');
        console.log('  npm run migrate:up        - Yangi migration\'larni ishga tushirish');
        console.log('  npm run migrate:down      - Oxirgi migration\'ni bekor qilish');
        console.log('  npm run migrate:pending   - Kutilayotgan migration\'larni ko\'rish');
        console.log('  npm run migrate:executed  - Bajarilgan migration\'larni ko\'rish');
        console.log('  npm run migrate:reset     - Barcha migration\'larni bekor qilish');
        console.log('  npm run migrate:create    - Yangi migration yaratish\n');
    }
  } catch (error) {
    console.error('\n❌ Xato yuz berdi:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
};

runMigrations();