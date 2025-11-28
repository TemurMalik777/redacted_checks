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
  // ❌ OLIB TASHLANG - Bu class fieldlar Sequelize bilan konflikt qiladi
  // public id!: number;
  // public firstName!: string;
  // ...

  // ✅ FAQAT DECLARE qiling
  declare id: number;
  declare firstName: string;
  declare lastName: string;
  declare phone: string;
  declare email: string;
  declare username: string;
  declare hashpassword: string;
  declare role: 'user' | 'admin';
  declare isActive: boolean;
  declare hashedRefreshToken?: string;
  declare refreshTokenExpires?: Date;
  declare lastLoginAt?: Date;
  
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

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
    delete (values as any).hashpassword;
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
      field: 'hashpassword', // ✅ DATABASE DA hashpassword
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
     * HOOKS - Parolni hash qilish
     */
    hooks: {
      beforeCreate: async (user: User) => {
        console.log('🔒 beforeCreate hook ishga tushdi');
        console.log('📝 Parol (oldin):', user.hashpassword);
        
        if (user.hashpassword && !user.hashpassword.startsWith('$2b$')) {
          const salt = await bcrypt.genSalt(10);
          user.hashpassword = await bcrypt.hash(user.hashpassword, salt);
          console.log('✅ Parol hash qilindi');
        }
      },
      
      beforeUpdate: async (user: User) => {
        console.log('🔒 beforeUpdate hook ishga tushdi');
        
        if (user.changed('hashpassword')) {
          console.log('📝 Parol o\'zgardi, hash qilinmoqda...');
          
          if (user.hashpassword && !user.hashpassword.startsWith('$2b$')) {
            const salt = await bcrypt.genSalt(10);
            user.hashpassword = await bcrypt.hash(user.hashpassword, salt);
            console.log('✅ Parol hash qilindi');
          }
        }
      },
    },
  }
);

export default User;