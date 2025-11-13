import User from './user/user.model';
import Import from './import';
import Check from './checks/checks.model';
import Faktura from './faktura/faktura.model';
import SelectCheck from './select_checks/selectChecks.model';

/**
 * Barcha model bog'lanishlarini (associations) o'rnatish
 * Bu fayl index.ts da import qilinishi kerak
 */

// User <-> Import
User.hasMany(Import, {
  foreignKey: 'importedBy',
  as: 'imports',
});

Import.belongsTo(User, {
  foreignKey: 'importedBy',
  as: 'user',
});

// Import <-> Check
Import.hasMany(Check, {
  foreignKey: 'importId',
  as: 'checks',
});

Check.belongsTo(Import, {
  foreignKey: 'importId',
  as: 'import',
});

// Import <-> Faktura
Import.hasMany(Faktura, {
  foreignKey: 'importId',
  as: 'fakturas',
});

Faktura.belongsTo(Import, {
  foreignKey: 'importId',
  as: 'import',
});

// Check <-> Faktura (agar kerak bo'lsa)
Check.hasMany(Faktura, {
  foreignKey: 'checkId',
  as: 'fakturas',
});

Faktura.belongsTo(Check, {
  foreignKey: 'checkId',
  as: 'check',
});

// User <-> SelectCheck
User.hasMany(SelectCheck, {
  foreignKey: 'userId',
  as: 'selectChecks',
});

SelectCheck.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

export { User, Import, Check, Faktura, SelectCheck };