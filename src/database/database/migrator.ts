// src/database/migrator.ts
import { Umzug, SequelizeStorage } from 'umzug';
import { sequelize } from './connection';
import path from 'path';

/**
 * Umzug migrator configuration
 */
export const migrator = new Umzug({
  migrations: {
    glob: [
      'migrations/*.ts',
      {
        cwd: __dirname,
        ignore: ['**/*.d.ts', '**/index.ts'],
      },
    ],
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({
    sequelize,
    tableName: 'migrations', // Migration history jadval nomi
  }),
  logger: console,
  create: {
    folder: path.join(__dirname, 'migrations'),
    template: (filepath) => [
      [
        filepath,
        `import { Migration } from '../migrator';
import { DataTypes } from 'sequelize';

export const up: Migration = async ({ context: queryInterface }) => {
  // Migration code here
};

export const down: Migration = async ({ context: queryInterface }) => {
  // Rollback code here
};
`,
      ],
    ],
  },
});

// Migration type for TypeScript
export type Migration = typeof migrator._types.migration;