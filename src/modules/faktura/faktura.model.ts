import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../../config/database';

/**
 * Faktura interfeysi
 *
 * Bu jadval Excel dan import qilinadigan fakturalar uchun
 * Fakturalar checks bilan matching qilinadi
 */
export interface FakturaAttributes {
  id: number;
  uuid: string;
  postTerminalSeria: string; // 🆕 Post terminal seriyasi
  creation_data_faktura: string; // Faktra bazadan yartilgan vaqti
  mxik: string; // MXIK kodi
  ulchov: string; // O'lchov birligi (dona, kg, litr, ...)
  fakturaSumma: number; // Faktura summasi
  fakturaMiqdor: number; // Faktura miqdori
  isActive: boolean; // Bu faktura ishlatilayaptimi
  relatedCheckId?: number; // Qaysi chekka bog'langan (agar matching bo'lsa)
  importId?: number; // Qaysi import operatsiyasi
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FakturaCreationAttributes
  extends Optional<
    FakturaAttributes,
    | 'id'
    | 'uuid'
    | 'postTerminalSeria'
    | 'isActive'
    | 'relatedCheckId'
    | 'importId'
    | 'createdAt'
    | 'updatedAt'
  > {}

/**
 * Faktura Model
 */
class Faktura
  extends Model<FakturaAttributes, FakturaCreationAttributes>
  implements FakturaAttributes
{
  public id!: number;
  public uuid!: string;
  public postTerminalSeria!: string; // 🆕 Post terminal seriyasi
  public creation_data_faktura!: string;
  public mxik!: string;
  public ulchov!: string;
  public fakturaSumma!: number;
  public fakturaMiqdor!: number;
  public isActive!: boolean;
  public relatedCheckId?: number;
  public importId?: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Bir birlik narxni hisoblash
   */
  public getUnitPrice(): number {
    if (this.fakturaMiqdor === 0) return 0;
    return this.fakturaSumma / this.fakturaMiqdor;
  }

  /**
   * Faktura summani formatlash
   */
  public getFormattedSumma(): string {
    return new Intl.NumberFormat('uz-UZ', {
      style: 'currency',
      currency: 'UZS',
      minimumFractionDigits: 2,
    }).format(this.fakturaSumma);
  }

  /**
   * Miqdorni formatlash (o'lchov birligi bilan)
   */
  public getFormattedMiqdor(): string {
    return `${this.fakturaMiqdor} ${this.ulchov}`;
  }
}

Faktura.init(
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
    postTerminalSeria: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: '',
      comment: 'Post terminal seriyasi',
    },
    creation_data_faktura: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'creation_data_faktura',
    },
    mxik: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
      comment: 'MXIK - Maxsulot klassifikatsiya kodi',
    },
    ulchov: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
      comment: "O'lchov birligi: dona, kg, litr, m, m2, m3, ...",
    },
    fakturaSumma: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: 'faktura_summa',
      validate: {
        min: 0,
      },
    },
    fakturaMiqdor: {
      type: DataTypes.DECIMAL(10, 3), // 3 ta kasr qism - aniqroq o'lchov uchun
      allowNull: false,
      field: 'faktura_miqdor',
      validate: {
        min: 0,
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true, // Default - aktiv
      field: 'is_active',
      comment: "False bo'lsa, bu faktura allaqachon ishlatilgan",
    },
    relatedCheckId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'related_check_id',
      references: {
        model: 'checks',
        key: 'id',
      },
      comment: "Agar matching qilingan bo'lsa, qaysi chekka tegishli",
    },
    importId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'import_id',
      references: {
        model: 'imports',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'faktura',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['mxik'],
      },
      {
        fields: ['is_active'],
      },
      {
        fields: ['related_check_id'],
      },
      {
        fields: ['import_id'],
      },
      {
        // Composite index - mxik va is_active uchun
        fields: ['mxik', 'is_active'],
      },
    ],
  },
);

export default Faktura;
