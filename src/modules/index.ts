/**
 * Models Index
 * 
 * Bu fayl barcha modellarni export qiladi va
 * ular o'rtasidagi relationshiplarni (bog'lanishlarni) o'rnatadi
 */

import User from './user/user.model';
import Import from './import';
import Check from './checks/checks.model';
import Faktura from './faktura/faktura.model';
import SelectCheck from './select_checks/selectChecks.model';
import ProcessLog from './Processlog';

/**
 * RELATIONSHIPS (Bog'lanishlar)
 * 
 * Sequelize da 4 xil relationship mavjud:
 * 1. hasOne - Birga bir
 * 2. belongsTo - Tegishli
 * 3. hasMany - Birga ko'p
 * 4. belongsToMany - Ko'pga ko'p
 */

/**
 * User relationships
 */
// User ko'p importlar yaratishi mumkin
User.hasMany(Import, {
  foreignKey: 'imported_by',
  as: 'imports',
});

Import.belongsTo(User, {
  foreignKey: 'imported_by',
  as: 'user',
});

// User ko'p checklar yaratishi mumkin
User.hasMany(Check, {
  foreignKey: 'created_by',
  as: 'checks',
});

Check.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'user',
});

/**
 * Import relationships
 */
// Bir import ko'p checklar va fakturalarni o'z ichiga olishi mumkin
Import.hasMany(Check, {
  foreignKey: 'import_id',
  as: 'checks',
});

Check.belongsTo(Import, {
  foreignKey: 'import_id',
  as: 'import',
});

Import.hasMany(Faktura, {
  foreignKey: 'import_id',
  as: 'fakturas',
});

Faktura.belongsTo(Import, {
  foreignKey: 'import_id',
  as: 'import',
});

/**
 * Check va Faktura relationship
 */
// Bir check bitta fakturaga bog'lanishi mumkin
Check.hasOne(Faktura, {
  foreignKey: 'related_check_id',
  as: 'faktura',
});

Faktura.belongsTo(Check, {
  foreignKey: 'related_check_id',
  as: 'relatedCheck',
});

/**
 * SelectCheck relationships
 */
// SelectCheck uchun process logs
SelectCheck.hasMany(ProcessLog, {
  foreignKey: 'select_check_id',
  as: 'logs',
});

ProcessLog.belongsTo(SelectCheck, {
  foreignKey: 'select_check_id',
  as: 'selectCheck',
});

/**
 * Export qilish
 */
export {
  User,
  Import,
  Check,
  Faktura,
  SelectCheck,
  ProcessLog,
};

/**
 * Model list - migration yoki sync uchun
 */
export const models = {
  User,
  Import,
  Check,
  Faktura,
  SelectCheck,
  ProcessLog,
};

export default models;