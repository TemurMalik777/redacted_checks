import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../../config/database';
import bcrypt from 'bcrypt';

/**
 * User interfeysi
 */
export interface UserAttributes {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  username: string;
  hashpassword: string;
  role: 'user' | 'admin';
  isActive: boolean;
  hashedRefreshToken?: string;
  refreshTokenExpires?: Date;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserCreationAttributes 
  extends Optional<UserAttributes, 'id' | 'role' | 'isActive' | 'hashedRefreshToken' | 'refreshTokenExpires' | 'lastLoginAt' | 'createdAt' | 'updatedAt'> {}

/**
 * User Model
 */
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public firstName!: string;
  public lastName!: string;
  public phone!: string;
  public email!: string;
  public username!: string;
  public hashpassword!: string;
  public role!: 'user' | 'admin';
  public isActive!: boolean;
  public hashedRefreshToken?: string;
  public refreshTokenExpires?: Date;
  public lastLoginAt?: Date;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Parolni tekshirish
   */
  public async comparePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.hashpassword);
  }

  /**
   * Refresh token hali faolmi?
   */
  public isRefreshTokenValid(): boolean {
    if (!this.hashedRefreshToken || !this.refreshTokenExpires) {
      return false;
    }
    return new Date() < this.refreshTokenExpires;
  }

  /**
   * JSON formatda qaytarish (parol va refresh token yashirinadi)
   */
  public toJSON(): Partial<UserAttributes> {
    const values = { ...this.get() };
    delete (values as any).password;
    delete (values as any).hashedRefreshToken;
    return values;
  }
}

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
      field: 'first_name',
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'last_name',
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    hashpassword: {
      type: DataTypes.STRING(255),
      allowNull: false,
      // ❌ FIELD BERILMAYDI - Sequelize avtomatik 'password' ishlatadi
    },
    role: {
      type: DataTypes.ENUM('user', 'admin'),
      allowNull: false,
      defaultValue: 'user',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    hashedRefreshToken: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'hashed_refresh_token',
    },
    refreshTokenExpires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'refresh_token_expires',
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
    timestamps: true,
    underscored: true,
    
    /**
     * HOOKS - MUHIM!
     * 
     * Bu hooklar har doim ishlaydi:
     * - beforeCreate: User.create() chaqirilganda
     * - beforeUpdate: user.update() chaqirilganda
     * - beforeSave: create yoki update dan oldin
     */
    hooks: {
      /**
       * CREATE dan oldin
       */
      beforeCreate: async (user: User) => {
        console.log('🔒 beforeCreate hook ishga tushdi');
        console.log('📝 Parol (oldin):', user.hashpassword);
        
        if (user.hashpassword) {
          const salt = await bcrypt.genSalt(10);
          user.hashpassword = await bcrypt.hash(user.hashpassword, salt);
          console.log('✅ Parol hash qilindi:', user.hashpassword);
        }
      },
      
      /**
       * UPDATE dan oldin
       */
      beforeUpdate: async (user: User) => {
        console.log('🔒 beforeUpdate hook ishga tushdi');
        
        // Faqat parol o'zgarganda hash qilish
        if (user.changed('hashpassword')) {
          console.log('📝 Parol o\'zgardi, hash qilinmoqda...');
          console.log('📝 Parol (oldin):', user.hashpassword);
          
          const salt = await bcrypt.genSalt(10);
          user.hashpassword = await bcrypt.hash(user.hashpassword, salt);
          console.log('✅ Parol hash qilindi:', user.hashpassword);
        }
      },
      
      /**
       * SAVE dan oldin (create va update ikkalasi uchun)
       */
      beforeSave: async (user: User) => {
        console.log('💾 beforeSave hook ishga tushdi');
        
        // Agar parol hali ham hash qilinmagan bo'lsa
        if (user.hashpassword && !user.hashpassword.startsWith('$2b$')) {
          console.log('⚠️  Parol hali hash qilinmagan! Hozir hash qilinmoqda...');
          const salt = await bcrypt.genSalt(10);
          user.hashpassword = await bcrypt.hash(user.hashpassword, salt);
          console.log('✅ beforeSave da hash qilindi:', user.hashpassword);
        }
      },
    },
  }
);

export default User;