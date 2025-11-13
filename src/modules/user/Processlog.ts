import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../../config/database';

/**
 * ProcessLog interfeysi
 *
 * Har bir browser automation jarayonini log qilish uchun
 * Debug va monitoring uchun juda muhim
 */
export interface ProcessLogAttributes {
  id: number;
  processName: string; // Jarayon nomi (masalan: "edit_check")
  selectCheckId?: number; // Qaysi select_check uchun
  status: 'started' | 'processing' | 'completed' | 'failed';
  message?: string; // Har bir bosqich haqida xabar
  errorDetails?: string; // Xato detallar (agar bo'lsa)
  screenshotPath?: string; // Screenshot fayl yo'li
  duration?: number; // Jarayon davomiyligi (sekund)
  startedAt?: Date;
  finishedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProcessLogCreationAttributes
  extends Optional<
    ProcessLogAttributes,
    | 'id'
    | 'selectCheckId'
    | 'status'
    | 'message'
    | 'errorDetails'
    | 'screenshotPath'
    | 'duration'
    | 'startedAt'
    | 'finishedAt'
    | 'createdAt'
    | 'updatedAt'
  > {}

/**
 * ProcessLog Model
 */
class ProcessLog
  extends Model<ProcessLogAttributes, ProcessLogCreationAttributes>
  implements ProcessLogAttributes
{
  public id!: number;
  public processName!: string;
  public selectCheckId?: number;
  public status!: 'started' | 'processing' | 'completed' | 'failed';
  public message?: string;
  public errorDetails?: string;
  public screenshotPath?: string;
  public duration?: number;
  public startedAt?: Date;
  public finishedAt?: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Duration hisoblash
   */
  public calculateDuration(): number | null {
    if (!this.startedAt || !this.finishedAt) return null;
    return Math.floor(
      (this.finishedAt.getTime() - this.startedAt.getTime()) / 1000,
    );
  }

  /**
   * Formatted duration (human-readable)
   */
  public getFormattedDuration(): string {
    const dur = this.duration || this.calculateDuration();
    if (!dur) return 'N/A';

    if (dur < 60) return `${dur}s`;
    const minutes = Math.floor(dur / 60);
    const seconds = dur % 60;
    return `${minutes}m ${seconds}s`;
  }
}

ProcessLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    processName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'process_name',
    },
    selectCheckId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'select_check_id',
      references: {
        model: 'select_checks',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM('started', 'processing', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'started',
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    errorDetails: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'error_details',
    },
    screenshotPath: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'screenshot_path',
    },
    duration: {
      type: DataTypes.INTEGER, // Sekund
      allowNull: true,
      comment: 'Jarayon davomiyligi (sekund)',
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'started_at',
    },
    finishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'finished_at',
    },
  },
  {
    sequelize,
    tableName: 'process_logs',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['select_check_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['process_name'],
      },
      {
        fields: ['created_at'],
      },
    ],
  },
);

export default ProcessLog;
