import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../../config/database';

/**
 * Check interfeysi
 *
 * Bu jadval Excel dan import qilinadigan cheklar uchun
 * Har bir chek alohida qator sifatida saqlanadi
 */
export interface CheckAttributes {
  id: number;
  uuid: string;
  creation_date_check: string; // Chek bazada yartilgan vaqti
  chekRaqam: string; // Chek raqami - UNIQUE
  chekSumma: number; // Chek summasi (decimal)
  maxsulotNomi: string; // Maxsulot nomi
  processed: boolean; // Bu chek qayta ishlangani (select_checks ga qo'shilgan)
  createdBy: number; // Qaysi user yaratgan
  source: 'excel' | 'manual'; // Qayerdan kelgani
  importId?: number; // Qaysi import operatsiyasiga tegishli
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CheckCreationAttributes
  extends Optional<
    CheckAttributes,
    | 'id'
    | 'uuid'
    | 'processed'
    | 'source'
    | 'importId'
    | 'createdAt'
    | 'updatedAt'
  > {}

/**
 * Check Model
 */
class Check
  extends Model<CheckAttributes, CheckCreationAttributes>
  implements CheckAttributes
{
  public id!: number;
  public uuid!: string;
  public creation_date_check!: string;
  public chekRaqam!: string;
  public chekSumma!: number;
  public maxsulotNomi!: string;
  public processed!: boolean;
  public createdBy!: number;
  public source!: 'excel' | 'manual';
  public importId?: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Chek summani formatlash (so'm bilan)
   */
  public getFormattedSumma(): string {
    return new Intl.NumberFormat('uz-UZ', {
      style: 'currency',
      currency: 'UZS',
      minimumFractionDigits: 2,
    }).format(this.chekSumma);
  }
}

Check.init(
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
    creation_date_check: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'creation_date_check',
    },
    chekRaqam: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true, // Chek raqam unique bo'lishi kerak
      field: 'chek_raqam',
      validate: {
        notEmpty: true,
      },
    },
    chekSumma: {
      type: DataTypes.DECIMAL(15, 2), // 15 raqam, 2 ta kasr qism
      allowNull: false,
      field: 'chek_summa',
      validate: {
        min: 0, // Manfiy summa bo'lmasligi kerak
      },
    },
    maxsulotNomi: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'maxsulot_nomi',
      validate: {
        notEmpty: true,
      },
    },
    processed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false, // Default - qayta ishlanmagan
      comment: "Bu chek select_checks jadvaliga qo'shilgani",
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    source: {
      type: DataTypes.ENUM('excel', 'manual'),
      allowNull: false,
      defaultValue: 'excel',
    },
    importId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'import_id',
      references: {
        model: 'imports',
        key: 'id',
      },
      // QO'SHISH:
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
  },
  {
    sequelize,
    tableName: 'checks',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['chek_raqam'],
        unique: true,
      },
      {
        fields: ['processed'],
      },
      {
        fields: ['created_by'],
      },
      {
        fields: ['import_id'],
      },
      {
        fields: ['created_at'],
      },
    ],
  },
);

export default Check;
