import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import crypto from 'crypto';
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
 * Auth Service - ODDIY VARIANT
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

    // Tokenlar yaratish
    const refreshToken = this.generateRefreshToken();
    const refreshTokenExpires = this.getRefreshTokenExpiry();

    // User yaratish
    const user = await User.create({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email,
      username: data.username,
      hashpassword: data.password,
      hashedRefreshToken: refreshToken,              // ✅ User jadvaliga
      refreshTokenExpires,       // ✅ User jadvaliga
    });

    const accessToken = this.generateAccessToken(user);

    return { user, accessToken, refreshToken };
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

    // Yangi tokenlar yaratish
    const refreshToken = this.generateRefreshToken();
    const refreshTokenExpires = this.getRefreshTokenExpiry();

    // User ni yangilash
    await user.update({
      hashedRefreshToken: refreshToken,
      refreshTokenExpires,
      lastLoginAt: new Date(),
    });

    const accessToken = this.generateAccessToken(user);

    return { user, accessToken, refreshToken };
  }

  /**
   * Token yangilash
   */
  async refreshAccessToken(
    oldRefreshToken: string,
    ipAddress?: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Refresh token orqali userni topish
    const user = await User.findOne({
      where: {
        hashedRefreshToken: oldRefreshToken,
        isActive: true,
      },
    });

    if (!user) {
      throw new Error('Refresh token yaroqsiz');
    }

    // Token muddatini tekshirish
    if (!user.isRefreshTokenValid()) {
      throw new Error('Refresh token muddati tugagan');
    }

    // Yangi tokenlar yaratish
    const newRefreshToken = this.generateRefreshToken();
    const refreshTokenExpires = this.getRefreshTokenExpiry();

    await user.update({
      hashedRefreshToken: newRefreshToken,
      refreshTokenExpires,
    });

    const accessToken = this.generateAccessToken(user);

    return { accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Logout
   */
  async logout(refreshToken: string, ipAddress?: string): Promise<void> {
    const user = await User.findOne({
      where: { hashedRefreshToken: refreshToken},
    });

    if (user) {
      await user.update({
        hashedRefreshToken: undefined,
        refreshTokenExpires: undefined,
      });
    }
  }

  /**
   * Barcha qurilmalardan logout
   */
  async logoutAll(userId: number, ipAddress?: string): Promise<void> {
    await User.update(
      {
        hashedRefreshToken: undefined,
        refreshTokenExpires: undefined,
      },
      {
        where: { id: userId },
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

  /**
   * Userni admin qilish
   */
  async makeAdmin(userId: number): Promise<User> {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User topilmadi');

    await user.update({ role: 'admin' });
    return user;
  }

  /**
   * Admin roleni olib tashlash
   */
  async removeAdmin(userId: number): Promise<User> {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User topilmadi');

    await user.update({ role: 'user' });
    return user;
  }
}

export default new AuthService();