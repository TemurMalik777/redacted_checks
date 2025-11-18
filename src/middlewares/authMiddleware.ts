import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { User, RefreshToken } from '../modules/index';
import { config } from '../config/env';

/**
 * JWT Token Payload
 */
interface TokenPayload {
  id: number;
  username: string;
  role: 'user' | 'admin';
  type: 'access';
}

/**
 * Auth Response
 */
interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterDTO {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  username: string;
  password: string; // ✅ Frontend'dan oddiy parol keladi
}

export interface LoginDTO {
  username: string;
  password: string;
}

/**
 * Auth Service - RefreshToken jadvali bilan
 */
class AuthService {
  /**
   * Access Token yaratish (15 daqiqa)
   */
  generateAccessToken(user: User): string {
    const payload: TokenPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
      type: 'access',
    };

    return jwt.sign(
      payload,
      config.ACCESS_TOKEN_SECRET as Secret,
      { expiresIn: config.ACCESS_TOKEN_EXPIRES_IN || '15m' }
    );
  }

  /**
   * Refresh Token yaratish (7 kun)
   */
  generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Refresh token expires date hisoblash
   */
  getRefreshTokenExpiry(): Date {
    const expiresAt = new Date();
    const days = parseInt(config.REFRESH_TOKEN_EXPIRES_IN.replace('d', '')) || 7;
    expiresAt.setDate(expiresAt.getDate() + days);
    return expiresAt;
  }

  /**
   * Access Token verify
   */
  verifyAccessToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(
        token,
        config.ACCESS_TOKEN_SECRET as Secret
      ) as TokenPayload;

      if (decoded.type !== 'access') {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Ro'yxatdan o'tish
   */
  async register(data: RegisterDTO, ipAddress?: string): Promise<AuthResponse> {
    // Mavjud userlarni tekshirish
    const existingUser = await User.findOne({ where: { username: data.username } });
    if (existingUser) throw new Error('Bu username allaqachon band');

    const existingEmail = await User.findOne({ where: { email: data.email } });
    if (existingEmail) throw new Error('Bu email allaqachon ro\'yxatdan o\'tgan');

    const existingPhone = await User.findOne({ where: { phone: data.phone } });
    if (existingPhone) throw new Error('Bu telefon raqam allaqachon ro\'yxatdan o\'tgan');

    // ✅ User yaratish - hook avtomatik hash qiladi
    const user = await User.create({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email,
      username: data.username,
      hashpassword: data.password, // ✅ Hook hash qiladi
    });

    // ✅ Refresh Token yaratish va jadvalga saqlash
    const refreshTokenString = this.generateRefreshToken();
    const expiresAt = this.getRefreshTokenExpiry();

    // ✅ Refresh token'ni hash qilib saqlash
    const hashedRefreshToken = await bcrypt.hash(refreshTokenString, 10);

    await RefreshToken.create({
      userId: user.id,
      token: hashedRefreshToken, // ✅ Hash qilingan
      expiresAt,
      createdByIp: ipAddress,
      isActive: true,
    });

    const accessToken = this.generateAccessToken(user);

    return { 
      user, 
      accessToken, 
      refreshToken: refreshTokenString // ✅ Cookiega oddiy token yuboramiz
    };
  }

  /**
   * Login qilish
   */
  async login(data: LoginDTO, ipAddress?: string): Promise<AuthResponse> {
    const user = await User.findOne({ where: { username: data.username } });
    if (!user) throw new Error('Username yoki parol noto\'g\'ri');

    if (!user.isActive) throw new Error('Sizning hisobingiz bloklangan');

    // ✅ Parolni tekshirish
    const isPasswordValid = await user.comparePassword(data.password);
    if (!isPasswordValid) throw new Error('Username yoki parol noto\'g\'ri');

    // ✅ Refresh Token yaratish
    const refreshTokenString = this.generateRefreshToken();
    const expiresAt = this.getRefreshTokenExpiry();
    const hashedRefreshToken = await bcrypt.hash(refreshTokenString, 10);

    await RefreshToken.create({
      userId: user.id,
      token: hashedRefreshToken,
      expiresAt,
      createdByIp: ipAddress,
      isActive: true,
    });

    // ✅ lastLoginAt yangilash
    await user.update({ lastLoginAt: new Date() });

    const accessToken = this.generateAccessToken(user);

    return { 
      user, 
      accessToken, 
      refreshToken: refreshTokenString 
    };
  }

  /**
   * Token yangilash
   */
  async refreshAccessToken(
    oldRefreshToken: string,
    ipAddress?: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // ✅ Barcha aktiv tokenlarni olamiz
    const activeTokens = await RefreshToken.findAll({
      where: {
        isActive: true,
        expiresAt: { [require('sequelize').Op.gt]: new Date() }
      },
    });

    // ✅ Qaysi token mos kelishini topamiz
    let matchedToken: any = null;
    for (const tokenRecord of activeTokens) {
      const isMatch = await bcrypt.compare(oldRefreshToken, tokenRecord.token);
      if (isMatch) {
        matchedToken = tokenRecord;
        break;
      }
    }

    if (!matchedToken) {
      throw new Error('Refresh token yaroqsiz yoki muddati tugagan');
    }

    // ✅ Userni topamiz
    const user = await User.findByPk(matchedToken.userId);
    if (!user || !user.isActive) {
      throw new Error('User topilmadi yoki bloklangan');
    }

    // ✅ Yangi refresh token yaratamiz
    const newRefreshTokenString = this.generateRefreshToken();
    const expiresAt = this.getRefreshTokenExpiry();
    const hashedNewRefreshToken = await bcrypt.hash(newRefreshTokenString, 10);

    // ✅ Eski tokenni bekor qilamiz
    await matchedToken.update({
      isActive: false,
      revokedAt: new Date(),
      revokedByIp: ipAddress,
      replacedByToken: hashedNewRefreshToken,
    });

    // ✅ Yangi tokenni saqlaymiz
    await RefreshToken.create({
      userId: user.id,
      token: hashedNewRefreshToken,
      expiresAt,
      createdByIp: ipAddress,
      isActive: true,
    });

    const accessToken = this.generateAccessToken(user);

    return { 
      accessToken, 
      refreshToken: newRefreshTokenString 
    };
  }

  /**
   * Logout
   */
  async logout(refreshToken: string, ipAddress?: string): Promise<void> {
    const activeTokens = await RefreshToken.findAll({
      where: { isActive: true },
    });

    for (const tokenRecord of activeTokens) {
      const isMatch = await bcrypt.compare(refreshToken, tokenRecord.token);
      if (isMatch) {
        await tokenRecord.update({
          isActive: false,
          revokedAt: new Date(),
          revokedByIp: ipAddress,
        });
        break;
      }
    }
  }

  /**
   * Barcha qurilmalardan logout
   */
  async logoutAll(userId: number, ipAddress?: string): Promise<void> {
    await RefreshToken.update(
      {
        isActive: false,
        revokedAt: new Date(),
        revokedByIp: ipAddress,
      },
      {
        where: { 
          userId,
          isActive: true 
        },
      }
    );
  }

  /**
   * Token orqali userni topish
   */
  async getUserByToken(token: string): Promise<User | null> {
    const payload = this.verifyAccessToken(token);
    if (!payload) return null;

    const user = await User.findByPk(payload.id);
    if (!user || !user.isActive) return null;

    return user;
  }

  /**
   * ID bo'yicha userni topish
   */
  async getUserById(id: number): Promise<User | null> {
    const user = await User.findByPk(id);
    if (!user || !user.isActive) return null;

    return user;
  }
}

export default new AuthService();