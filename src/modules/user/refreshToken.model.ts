import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../../config/database';

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

class RefreshToken extends Model<RefreshTokenAttributes, RefreshTokenCreationAttributes> implements RefreshTokenAttributes {
  // ✅ DECLARE ishlatish
  declare id: number;
  declare userId: number;
  declare token: string;
  declare expiresAt: Date;
  declare createdByIp?: string;
  declare revokedAt?: Date;
  declare revokedByIp?: string;
  declare replacedByToken?: string;
  declare isActive: boolean;
  
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  public isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

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
      field: 'user_id',
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
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['token'] },
      { fields: ['expires_at'] },
    ],
  }
);

export default RefreshToken;