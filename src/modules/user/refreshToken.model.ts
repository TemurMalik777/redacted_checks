import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../../config/database';

/**
 * RefreshToken interfeysi
 */
export interface RefreshTokenAttributes {
  id: number;
  userId: number;
  token: string;
  expiresAt: Date;
  createdByIp?: string;
  revokedAt?: Date;
  revokedByIp?: string;
  replacedByToken?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RefreshTokenCreationAttributes 
  extends Optional<RefreshTokenAttributes, 'id' | 'createdByIp' | 'revokedAt' | 'revokedByIp' | 'replacedByToken' | 'isActive' | 'createdAt' | 'updatedAt'> {}

/**
 * RefreshToken Model
 */
class RefreshToken extends Model<RefreshTokenAttributes, RefreshTokenCreationAttributes> implements RefreshTokenAttributes {
  public id!: number;
  public userId!: number;
  public token!: string;
  public expiresAt!: Date;
  public createdByIp?: string;
  public revokedAt?: Date;
  public revokedByIp?: string;
  public replacedByToken?: string;
  public isActive!: boolean;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Token hali faolmi?
   */
  public isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  /**
   * Token bekor qilinganmi?
   */
  public isRevoked(): boolean {
    return !!this.revokedAt;
  }
}

RefreshToken.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id', // ✅ DATABASE DA snake_case
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    token: {
      type: DataTypes.STRING(500),
      allowNull: false,
      unique: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
    createdByIp: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'created_by_ip',
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'revoked_at',
    },
    revokedByIp: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'revoked_by_ip',
    },
    replacedByToken: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'replaced_by_token',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
  },
  {
    sequelize,
    tableName: 'refresh_tokens',
    timestamps: true,
    underscored: true, // ✅ Bu avtomatik camelCase -> snake_case
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['token'],
      },
      {
        fields: ['expires_at'],
      },
    ],
  }
);

export default RefreshToken;