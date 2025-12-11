import { Model, DataTypes, Optional, Association } from 'sequelize';
import sequelize from '../../config/database';

/**
 * Import interfeysi
 */
export interface ImportAttributes {
  id: number;
  uuid: string;
  fileName: string;
  isActive: boolean;
  processed: boolean;
  source: 'excel' | 'manual';
  totalRows: number;
  importedRows: number;
  failedRows: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  importedBy: number;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ImportCreationAttributes
  extends Optional<
    ImportAttributes,
    | 'id'
    | 'uuid'
    | 'isActive'
    | 'processed'
    | 'importedRows'
    | 'failedRows'
    | 'status'
    | 'errorMessage'
    | 'startedAt'
    | 'finishedAt'
    | 'createdAt'
    | 'updatedAt'
  > {}

/**
 * Import Model
 */
class Import
  extends Model<ImportAttributes, ImportCreationAttributes>
  implements ImportAttributes
{
  public id!: number;
  public uuid!: string;
  public fileName!: string;
  public isActive!: boolean;
  public processed!: boolean;
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

  // Associations
  public readonly user?: any;
  public readonly checks?: any[];
  public readonly fakturas?: any[];

  public static associations: {
    user: Association<Import, any>;
    checks: Association<Import, any>;
    fakturas: Association<Import, any>;
  };

  /**
   * Import duration hisoblash (soniyalarda)
   */
  public getDuration(): number | null {
    if (!this.startedAt || !this.finishedAt) return null;
    return Math.floor(
      (this.finishedAt.getTime() - this.startedAt.getTime()) / 1000,
    );
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
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      unique: true,
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    processed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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
    },
    importedRows: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    failedRows: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    importedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    finishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'imports',
    timestamps: true,
    underscored: true, // Bu avtomatik camelCase -> snake_case qiladi
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
      {
        fields: ['is_active'],
      },
    ],
  },
);

export default Import;
