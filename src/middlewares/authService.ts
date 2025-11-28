import jwt, { Secret } from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { User } from '../modules/index';
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
  password: string;
}

export interface LoginDTO {
  username: string;
  password: string;
}

/**
 * Auth Service - User jadvalida saqlash
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
   * Refresh Token yaratish
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
    const existingUser = await User.findOne({ where: { username: data.username } });
    if (existingUser) throw new Error('Bu username allaqachon band');

    const existingEmail = await User.findOne({ where: { email: data.email } });
    if (existingEmail) throw new Error('Bu email allaqachon ro\'yxatdan o\'tgan');

    const existingPhone = await User.findOne({ where: { phone: data.phone } });
    if (existingPhone) throw new Error('Bu telefon raqam allaqachon ro\'yxatdan o\'tgan');

    // Refresh Token yaratish
    const refreshTokenString = this.generateRefreshToken();
    console.log('🔑 Refresh token yaratildi:', refreshTokenString.substring(0, 20) + '...');
    
    const refreshTokenExpires = this.getRefreshTokenExpiry();
    
    // ✅ Hash qilish
    const hashedRefreshToken = await bcrypt.hash(refreshTokenString, 10);
    console.log('🔒 Refresh token hash qilindi:', hashedRefreshToken.substring(0, 30) + '...');

    // ✅ User yaratish - parol va refresh token bilan
    const user = await User.create({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email,
      username: data.username,
      hashpassword: data.password,
      hashedRefreshToken, // ✅ USER JADVALIGA
      refreshTokenExpires, // ✅ USER JADVALIGA
    });
    console.log('💾 User va refresh token database ga saqlandi');

    const accessToken = this.generateAccessToken(user);

    return { 
      user, 
      accessToken, 
      refreshToken: refreshTokenString // ✅ Cookie uchun oddiy
    };
  }

  /**
   * Login qilish
   */
  async login(data: LoginDTO, ipAddress?: string): Promise<AuthResponse> {
    const user = await User.findOne({ where: { username: data.username } });
    if (!user) throw new Error('Username yoki parol noto\'g\'ri');

    if (!user.isActive) throw new Error('Sizning hisobingiz bloklangan');

    const isPasswordValid = await user.comparePassword(data.password);
    if (!isPasswordValid) throw new Error('Username yoki parol noto\'g\'ri');

    // Yangi refresh token
    const refreshTokenString = this.generateRefreshToken();
    console.log('🔑 Login: Refresh token yaratildi');
    
    const refreshTokenExpires = this.getRefreshTokenExpiry();
    const hashedRefreshToken = await bcrypt.hash(refreshTokenString, 10);
    console.log('🔒 Login: Refresh token hash qilindi');

    // ✅ User jadvalida yangilash
    await user.update({
      hashedRefreshToken,
      refreshTokenExpires,
      lastLoginAt: new Date(),
    });
    console.log('💾 Login: Refresh token user jadvalida yangilandi');

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
    console.log('🔄 Refresh token yangilanmoqda...');

    // ✅ Barcha active userlarni topish
    const users = await User.findAll({
      where: {
        isActive: true,
        hashedRefreshToken: { [require('sequelize').Op.ne]: null },
      },
    });

    // ✅ Qaysi user refresh tokeniga mos kelishini topish
    let matchedUser: User | null = null;
    for (const user of users) {
      if (user.hashedRefreshToken) {
        const isMatch = await bcrypt.compare(oldRefreshToken, user.hashedRefreshToken);
        if (isMatch) {
          matchedUser = user;
          break;
        }
      }
    }

    if (!matchedUser) {
      throw new Error('Refresh token yaroqsiz');
    }

    // ✅ Token muddatini tekshirish
    if (!matchedUser.isRefreshTokenValid()) {
      throw new Error('Refresh token muddati tugagan');
    }
    console.log('✅ Eski token topildi va tekshirildi');

    // Yangi refresh token
    const newRefreshTokenString = this.generateRefreshToken();
    const refreshTokenExpires = this.getRefreshTokenExpiry();
    const hashedRefreshToken = await bcrypt.hash(newRefreshTokenString, 10);

    await matchedUser.update({
      hashedRefreshToken,
      refreshTokenExpires,
    });
    console.log('✅ Yangi token yaratildi va saqlandi');

    const accessToken = this.generateAccessToken(matchedUser);

    return { 
      accessToken, 
      refreshToken: newRefreshTokenString 
    };
  }

  /**
   * Logout
   */
  async logout(refreshToken: string, ipAddress?: string): Promise<void> {
    console.log('👋 Logout qilinmoqda...');

    const users = await User.findAll({
      where: {
        hashedRefreshToken: { [require('sequelize').Op.ne]: null },
      },
    });

    for (const user of users) {
      if (user.hashedRefreshToken) {
        const isMatch = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
        if (isMatch) {
          await user.update({
            hashedRefreshToken: undefined,
            refreshTokenExpires: undefined,
          });
          console.log('✅ Refresh token o\'chirildi');
          break;
        }
      }
    }
  }

  /**
   * Barcha qurilmalardan logout
   */
  async logoutAll(userId: number, ipAddress?: string): Promise<void> {
    console.log('👋 Barcha qurilmalardan logout...');
    
    await User.update(
      {
        hashedRefreshToken: undefined,
        refreshTokenExpires: undefined,
      },
      {
        where: { id: userId },
      }
    );
    console.log('✅ User refresh tokeni o\'chirildi');
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