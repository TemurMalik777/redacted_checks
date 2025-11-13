import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../../config/database';

/**
 * SelectCheck interfeysi
 * 
 * BU ENG MUHIM JADVAL!
 */
export interface SelectCheckAttributes {
  id: number;
  
  // Faktura ma'lumotlari
  mxik: string;
  ulchov: string;
  fakturaSumma: number;
  fakturaMiqdor: number;
  
  // Check ma'lumotlari
  chekRaqam: string;
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
  errorMessage?: string;
  
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SelectCheckCreationAttributes 
  extends Optional<SelectCheckAttributes, 'id' | 'isActive' | 'processed' | 'automationStatus' | 'errorMessage' | 'createdAt' | 'updatedAt'> {}

/**
 * SelectCheck Model
 */
class SelectCheck extends Model<SelectCheckAttributes, SelectCheckCreationAttributes> implements SelectCheckAttributes {
  public id!: number;
  
  // Faktura
  public mxik!: string;
  public ulchov!: string;
  public fakturaSumma!: number;
  public fakturaMiqdor!: number;
  
  // Check
  public chekRaqam!: string;
  public maxsulotNomi!: string;
  public chekSumma!: number;
  
  // Calculated
  public miqdor!: number;
  public umumiyChekSumma!: number;
  public birBirlik!: number;
  
  // Status
  public isActive!: boolean;
  public processed!: boolean;
  public automationStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  public errorMessage?: string;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Bir birlik narxni qayta hisoblash
   */
  public recalculateBirBirlik(): void {
    if (this.fakturaMiqdor > 0) {
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
      !this.isActive &&
      !this.processed &&
      Boolean(this.chekRaqam) &&
      Boolean(this.mxik) &&
      Boolean(this.ulchov) &&
      this.miqdor > 0 &&
      this.fakturaSumma > 0
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
    
    // Faktura fields
    mxik: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    ulchov: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
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
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
      field: 'faktura_miqdor',
      validate: {
        min: 0,
      },
    },
    
    // Check fields
    chekRaqam: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'chek_raqam',
      validate: {
        notEmpty: true,
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
    chekSumma: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: 'chek_summa',
      validate: {
        min: 0,
      },
    },
    
    // Calculated fields
    miqdor: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
      validate: {
        min: 0,
      },
      comment: 'Chek bo\'yicha maxsulot miqdori',
    },
    umumiyChekSumma: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: 'umumiy_chek_summa',
      validate: {
        min: 0,
      },
    },
    birBirlik: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: 'bir_birlik',
      validate: {
        min: 0,
      },
    },
    
    // Status fields
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_active',
    },
    processed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    automationStatus: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
      allowNull: true,
      field: 'automation_status',
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'error_message',
    },
  },
  {
    sequelize,
    tableName: 'select_checks',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['is_active'],
      },
      {
        fields: ['processed'],
      },
      {
        fields: ['automation_status'],
      },
      {
        fields: ['chek_raqam'],
      },
      {
        fields: ['mxik'],
      },
    ],
    
    hooks: {
      beforeCreate: (selectCheck: SelectCheck) => {
        selectCheck.recalculateBirBirlik();
      },
      beforeUpdate: (selectCheck: SelectCheck) => {
        if (selectCheck.changed('fakturaSumma') || selectCheck.changed('fakturaMiqdor')) {
          selectCheck.recalculateBirBirlik();
        }
      },
    },
  }
);

export default SelectCheck;