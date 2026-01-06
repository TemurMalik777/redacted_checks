import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../../config/database';

/**
 * SelectCheck interfeysi
 *
 * BU ENG MUHIM JADVAL!
 * Faktura va Check ma'lumotlarini birlashtiradi
 */
export interface SelectCheckAttributes {
  id: number;
  uuid: string;

  postTerminalSeria: string; // 🆕 Post terminal seriyasi

  // Faktura ma'lumotlari
  creationDataFaktura: string;
  mxik?: string | null;
  ulchov: string;
  fakturaSumma: number;
  fakturaMiqdor: number;

  // Check ma'lumotlari
  creation_date_check?: string | null; // 🆕 Chek sanasi
  chekRaqam?: string | null;
  maxsulotNomi: string;
  chekSumma: number;

  // Hisoblangan maydonlar
  miqdor: number;
  umumiyChekSumma: number;
  birBirlik: number;

  // Status
  isActive: boolean;
  processed: boolean;
  automationStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface SelectCheckCreationAttributes
  extends Optional<
    SelectCheckAttributes,
    | 'id'
    | 'uuid'
    | 'creation_date_check'
    | 'isActive'
    | 'processed'
    | 'automationStatus'
    | 'errorMessage'
    | 'createdAt'
    | 'updatedAt'
  > {}

/**
 * SelectCheck Model
 */
class SelectCheck
  extends Model<SelectCheckAttributes, SelectCheckCreationAttributes>
  implements SelectCheckAttributes
{
  declare id: number;
  declare uuid: string;

  declare postTerminalSeria: string; // 🆕 Post terminal seriyasi

  // Faktura
  declare creationDataFaktura: string;
  declare mxik: string;
  declare ulchov: string;
  declare fakturaSumma: number;
  declare fakturaMiqdor: number;

  // Check
  declare creationDateCheck: string; // 🆕
  declare chekRaqam: string;
  declare maxsulotNomi: string;
  declare chekSumma: number;

  // Calculated
  declare miqdor: number;
  declare umumiyChekSumma: number;
  declare birBirlik: number;

  // Status
  declare isActive: boolean;
  declare processed: boolean;
  declare automationStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  declare errorMessage?: string;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  /**
   * Bir birlik narxni qayta hisoblash
   * Formula: umumiyChekSumma / fakturaMiqdor
   */
  public recalculateBirBirlik(): void {
    if (this.fakturaMiqdor > 0 && this.umumiyChekSumma > 0) {
      this.birBirlik = this.umumiyChekSumma / this.fakturaMiqdor;
    } else if (this.fakturaMiqdor > 0) {
      this.birBirlik = this.fakturaSumma / this.fakturaMiqdor;
    } else {
      this.birBirlik = 0;
    }
  }

  /**
   * Automation uchun tayyor ekanligini tekshirish
   */
  public isReadyForAutomation(): boolean {
    return (
      this.isActive === true &&
      this.processed === false &&
      Boolean(this.chekRaqam) &&
      Boolean(this.mxik) &&
      Boolean(this.ulchov) &&
      this.miqdor > 0 &&
      this.fakturaSumma > 0
    );
  }

  /**
   * Foiz farqini hisoblash (chek vs faktura)
   */
  public getPercentageDifference(): number {
    if (this.fakturaSumma === 0) return 0;
    return (
      ((this.umumiyChekSumma - this.fakturaSumma) / this.fakturaSumma) * 100
    );
  }
}

SelectCheck.init(
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
      allowNull: false,
      field: 'post_terminal_seria',
      validate: {
        notEmpty: true,
      },
      comment: 'Post terminal seriyasi',
    },

    // =============================================
    // FAKTURA FIELDS
    // =============================================
    creationDataFaktura: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'creation_data_faktura',
      comment: 'Faktura yaratilgan sana',
    },
    mxik: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
      comment: 'MXIK kodi',
    },
    ulchov: {
      type: DataTypes.STRING(350),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
      comment: "O'lchov birligi (dona, kg, litr, ...)",
    },
    fakturaSumma: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: 'faktura_summa',
      validate: {
        min: 0,
      },
      comment: 'Faktura summasi',
    },
    fakturaMiqdor: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: false,
      field: 'faktura_miqdor',
      validate: {
        min: 0,
      },
      comment: 'Faktura miqdori',
    },

    // =============================================
    // CHECK FIELDS
    // =============================================
    creation_date_check: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'creation_date_check',
      comment: 'Chek yaratilgan sana (🆕)',
    },
    chekRaqam: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'chek_raqam',
      validate: {
        notEmpty: true,
      },
      comment: 'Chek raqami',
    },
    maxsulotNomi: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'maxsulot_nomi',
      validate: {
        notEmpty: true,
      },
      comment: 'Maxsulot nomi',
    },
    chekSumma: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: 'chek_summa',
      validate: {
        min: 0,
      },
      comment: 'Chek summasi',
    },

    // =============================================
    // CALCULATED FIELDS
    // =============================================
    miqdor: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: false,
      validate: {
        min: 0,
      },
      comment: "Chek bo'yicha maxsulot miqdori (hisoblangan)",
    },
    umumiyChekSumma: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: 'umumiy_chek_summa',
      validate: {
        min: 0,
      },
      comment: 'Umumiy cheklar summasi (bir faktura uchun)',
    },
    birBirlik: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: 'bir_birlik',
      validate: {
        min: 0,
      },
      comment: 'Bir birlik narxi (umumiyChekSumma / fakturaMiqdor)',
    },

    // =============================================
    // STATUS FIELDS
    // =============================================
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_active',
      comment: 'Automation uchun tayyor (true = tayyor)',
    },
    processed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Automation tugaganmi',
    },
    automationStatus: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
      allowNull: true,
      defaultValue: 'pending',
      field: 'automation_status',
      comment: 'Automation holati',
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'error_message',
      comment: "Xato xabari (agar bo'lsa)",
    },
  },
  {
    sequelize,
    tableName: 'select_checks',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['is_active'] },
      { fields: ['processed'] },
      { fields: ['automation_status'] },
      { fields: ['chek_raqam'] },
      { fields: ['mxik'] },
      { fields: ['creation_data_faktura'] }, // 🆕
      { fields: ['creation_date_check'] }, // 🆕
    ],

    hooks: {
      beforeCreate: (selectCheck: SelectCheck) => {
        selectCheck.recalculateBirBirlik();
      },
      beforeUpdate: (selectCheck: SelectCheck) => {
        if (
          selectCheck.changed('fakturaSumma') ||
          selectCheck.changed('fakturaMiqdor') ||
          selectCheck.changed('umumiyChekSumma')
        ) {
          selectCheck.recalculateBirBirlik();
        }
      },
    },
  },
);

export default SelectCheck;
