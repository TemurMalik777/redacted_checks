import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../../config/database';

/**
 * Import interfeysi
 * 
 * Bu jadval Excel import jarayonlarini log qilish uchun
 * Har bir import operatsiyasi bu jadvalga yoziladi
 */
export interface ImportAttributes {
  id: number;
  fileName: string;           // Yuklangan fayl nomi
  source: 'excel' | 'manual'; // Qayerdan kelgani
  totalRows: number;          // Jami qatorlar soni
  importedRows: number;       // Muvaffaqiyatli import qilingan qatorlar
  failedRows: number;         // Xatolik bo'lgan qatorlar
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;      // Xatolik xabari (agar bo'lsa)
  importedBy: number;         // Qaysi user import qilgan (user_id)
  startedAt?: Date;
  finishedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ImportCreationAttributes 
  extends Optional<ImportAttributes, 'id' | 'importedRows' | 'failedRows' | 'status' | 'errorMessage' | 'startedAt' | 'finishedAt' | 'createdAt' | 'updatedAt'> {}

/**
 * Import Model
 */
class Import extends Model<ImportAttributes, ImportCreationAttributes> implements ImportAttributes {
  public id!: number;
  public fileName!: string;
  public source!: 'excel' | 'manual';
  public totalRows!: number;
  public importedRows!: number;
  public failedRows!: number;
  public status!: 'pending' | 'processing' | 'completed' | 'failed';
  public errorMessage?: string;
  public importedBy!: number;
  public startedAt?: Date;
  public finishedAt?: Date;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Import duration hisoblash (soniyalarda)
   */
  public getDuration(): number | null {
    if (!this.startedAt || !this.finishedAt) return null;
    return Math.floor((this.finishedAt.getTime() - this.startedAt.getTime()) / 1000);
  }

  /**
   * Success rate hisoblash (foizda)
   */
  public getSuccessRate(): number {
    if (this.totalRows === 0) return 0;
    return Math.round((this.importedRows / this.totalRows) * 100);
  }
}

Import.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'file_name',
    },
    source: {
      type: DataTypes.ENUM('excel', 'manual'),
      allowNull: false,
      defaultValue: 'excel',
    },
    totalRows: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'total_rows',
    },
    importedRows: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'imported_rows',
    },
    failedRows: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'failed_rows',
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'error_message',
    },
    importedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'imported_by',
      references: {
        model: 'users',
        key: 'id',
      },
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
    tableName: 'imports',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['imported_by'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['created_at'],
      },
    ],
  }
);

export default Import;