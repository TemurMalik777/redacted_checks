import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../modules/index';
import RefreshToken from '../modules/user/refreshToken.model';
import { config } from '../config/env';

/**
 * JWT Token Payload
 */
interface TokenPayload {
  id: number;
  username: string;
  role: 'user' | 'admin';
  type: 'access' | 'refresh';
}

/**
 * Auth Response
 */
interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/**
 * Register DTO
 */
export interface RegisterDTO {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  username: string;
  password: string;
  role?: 'user' | 'admin';
}

/**
 * Login DTO
 */
export interface LoginDTO {
  username: string;
  password: string;
}

/**
 * Auth Service
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

    const options: SignOptions = {
      expiresIn: config.ACCESS_TOKEN_EXPIRES_IN || '15m',
    };

    return jwt.sign(
      payload,
      config.ACCESS_TOKEN_SECRET as Secret,
      options
    );
  }

  /**
   * Refresh Token yaratish (7 kun)
   * 
   * Crypto yordamida random token
   */
  generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Refresh Token ni database ga saqlash
   */
  async saveRefreshToken(
    userId: number,
    token: string,
    ipAddress?: string
  ): Promise<RefreshToken> {
    // Expires date hisoblash
    const expiresAt = new Date();
    const daysToAdd = parseInt(config.REFRESH_TOKEN_EXPIRES_IN.replace('d', '')) || 7;
    expiresAt.setDate(expiresAt.getDate() + daysToAdd);

    return await RefreshToken.create({
      userId,
      token,
      expiresAt,
      createdByIp: ipAddress,
    });
  }

  /**
   * Access Token verify qilish
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
   * Refresh Token verify qilish
   */
  async verifyRefreshToken(token: string): Promise<RefreshToken | null> {
    const refreshToken = await RefreshToken.findOne({
      where: {
        token,
        isActive: true,
      },
      include: [
        {
          model: User,
          as: 'user',
        },
      ],
    });

    if (!refreshToken) return null;

    if (refreshToken.isExpired()) {
      return null;
    }

    if (refreshToken.isRevoked()) {
      return null;
    }

    return refreshToken;
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

    const user = await User.create({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email,
      username: data.username,
      password: data.password,
      role: data.role || 'user',
    });

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    await this.saveRefreshToken(user.id, refreshToken, ipAddress);

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

    await user.update({ lastLoginAt: new Date() });

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    await this.saveRefreshToken(user.id, refreshToken, ipAddress);

    return { user, accessToken, refreshToken };
  }

  /**
   * Token yangilash
   */
  async refreshAccessToken(
    oldRefreshToken: string,
    ipAddress?: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenRecord = await this.verifyRefreshToken(oldRefreshToken);

    if (!tokenRecord) {
      throw new Error('Refresh token yaroqsiz yoki muddati tugagan');
    }

    const user = await User.findByPk(tokenRecord.userId);
    if (!user || !user.isActive) {
      throw new Error('User topilmadi yoki faol emas');
    }

    await tokenRecord.update({
      revokedAt: new Date(),
      revokedByIp: ipAddress,
    });

    const accessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken();

    await this.saveRefreshToken(user.id, newRefreshToken, ipAddress);

    await tokenRecord.update({
      replacedByToken: newRefreshToken,
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Logout
   */
  async logout(refreshToken: string, ipAddress?: string): Promise<void> {
    const tokenRecord = await RefreshToken.findOne({
      where: { token: refreshToken },
    });

    if (tokenRecord) {
      await tokenRecord.update({
        revokedAt: new Date(),
        revokedByIp: ipAddress,
        isActive: false,
      });
    }
  }

  /**
   * Barcha tokenlarni bekor qilish
   */
  async logoutAll(userId: number, ipAddress?: string): Promise<void> {
    await RefreshToken.update(
      {
        revokedAt: new Date(),
        revokedByIp: ipAddress,
        isActive: false,
      },
      {
        where: {
          userId,
          isActive: true,
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