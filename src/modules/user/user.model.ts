import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../../config/database';
import bcrypt from 'bcrypt';

/**
 * User interfeysi - jadval strukturasi
 * 
 * IZOH: Bu interfeys User jadvalidagi barcha ustunlarni aks ettiradi
 * TypeScript yordamida type safety ta'minlanadi
 */
export interface UserAttributes {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  username: string;
  password: string;
  role: 'user' | 'admin';  // Faqat 2 ta rol
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User yaratish uchun interfeys
 * id, createdAt, updatedAt optional chunki ular avtomatik yaratiladi
 */
export interface UserCreationAttributes 
  extends Optional<UserAttributes, 'id' | 'role' | 'isActive' | 'lastLoginAt' | 'createdAt' | 'updatedAt'> {}

/**
 * User Model klassi
 * 
 * Bu klass Sequelize Model dan meros oladi va
 * User jadvali bilan ishlash uchun barcha metodlarni beradi
 */
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public firstName!: string;
  public lastName!: string;
  public phone!: string;
  public email!: string;
  public username!: string;
  public password!: string;
  public role!: 'user' | 'admin';
  public isActive!: boolean;
  public lastLoginAt?: Date;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Parolni tekshirish metodi
   * 
   * @param password - tekshiriladigan parol
   * @returns boolean - parol to'g'ri bo'lsa true
   * 
   * IZOH: bcrypt.compare() hash bilan oddiy parolni solishtiradi
   * Bu xavfsiz chunki parol hech qachon ochiq ko'rinishda saqlanmaydi
   */
  public async comparePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  /**
   * Foydalanuvchi ma'lumotlarini JSON formatda qaytarish
   * Parolni olib tashlash bilan!
   * 
   * IZOH: Frontend ga user ma'lumoti yuborilganda parol ko'rinmasligi kerak
   */
  public toJSON(): Partial<UserAttributes> {
    const values = { ...this.get() };
    delete (values as any).password;  // Parolni o'chirish
    return values;
  }
}

/**
 * User modelini initialize qilish
 * 
 * Bu yerda jadval strukturasi aniqlanadi
 */
User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'first_name',  // Database da snake_case
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'last_name',
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,  // Telefon raqam unique bo'lishi kerak
      validate: {
        notEmpty: true,
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,  // Email formatini tekshirish
      },
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],  // Username 3-50 ta belgi
        isAlphanumeric: true,  // Faqat harf va raqamlar
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [6, 255],  // Minimum 6 ta belgi
      },
    },
    role: {
      type: DataTypes.ENUM('user', 'admin'),
      allowNull: false,
      defaultValue: 'user',  // Default - oddiy foydalanuvchi
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login_at',
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,  // createdAt va updatedAt avtomatik
    underscored: true, // snake_case field nomlar
    
    /**
     * Hooks - Ma'lum hodisalarda avtomatik bajariladigan funksiyalar
     * 
     * beforeCreate va beforeUpdate - Parolni hash qilish uchun
     */
    hooks: {
      /**
       * User yaratilishidan oldin parolni hash qilish
       */
      beforeCreate: async (user: User) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);  // Salt yaratish
          user.password = await bcrypt.hash(user.password, salt);  // Parolni hash qilish
        }
      },
      
      /**
       * User o'zgartirilishidan oldin yangi parolni hash qilish
       */
      beforeUpdate: async (user: User) => {
        // Faqat parol o'zgarganda hash qilish
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  }
);

export default User;