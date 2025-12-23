// src/database/migrations/20241217T120000.add-status-to-checks.ts
import { Migration } from '../migrator';
import { DataTypes } from 'sequelize';

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('checks', 'status', {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    defaultValue: 'pending',
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('checks', 'status');
};