/**
 * Models Index
 */

import User from './user/user.model';
import Import from './import/import.model';
import Check from './checks/checks.model';
import Faktura from './faktura/faktura.model';
import SelectCheck from './select_checks/selectChecks.model';
import ProcessLog from './user/Processlog';
import RefreshToken from './user/refreshToken.model'; // ✅ YANGI!

/**
 * RELATIONSHIPS
 */

// User <-> Import
User.hasMany(Import, {
  foreignKey: 'imported_by',
  as: 'imports',
});

Import.belongsTo(User, {
  foreignKey: 'imported_by',
  as: 'user',
});

// User <-> Check
User.hasMany(Check, {
  foreignKey: 'created_by',
  as: 'checks',
});

Check.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'user',
});

// Import <-> Check
Import.hasMany(Check, {
  foreignKey: 'import_id',
  as: 'checks',
});

Check.belongsTo(Import, {
  foreignKey: 'import_id',
  as: 'import',
});

// Import <-> Faktura
Import.hasMany(Faktura, {
  foreignKey: 'import_id',
  as: 'fakturas',
});

Faktura.belongsTo(Import, {
  foreignKey: 'import_id',
  as: 'import',
});

// Check <-> Faktura
Check.hasOne(Faktura, {
  foreignKey: 'related_check_id',
  as: 'faktura',
});

Faktura.belongsTo(Check, {
  foreignKey: 'related_check_id',
  as: 'relatedCheck',
});

// SelectCheck <-> ProcessLog
SelectCheck.hasMany(ProcessLog, {
  foreignKey: 'select_check_id',
  as: 'logs',
});

ProcessLog.belongsTo(SelectCheck, {
  foreignKey: 'select_check_id',
  as: 'selectCheck',
});

// User <-> RefreshToken ✅ YANGI!
User.hasMany(RefreshToken, {
  foreignKey: 'user_id',
  as: 'refreshTokens',
});

RefreshToken.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

/**
 * Export
 */
export {
  User,
  Import,
  Check,
  Faktura,
  SelectCheck,
  ProcessLog,
  RefreshToken, // ✅ YANGI!
};

export const models = {
  User,
  Import,
  Check,
  Faktura,
  SelectCheck,
  ProcessLog,
  RefreshToken, // ✅ YANGI!
};

export default models;
