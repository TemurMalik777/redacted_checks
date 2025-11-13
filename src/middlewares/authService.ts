import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { User } from '../modules/index';
import { config } from '../config/env';
import type { StringValue } from 'ms';

/**
 * JWT Token Payload interfeysi
 */
interface TokenPayload {
  id: number;
  username: string;
  role: 'user' | 'admin';
}

/**
 * Register DTO (Data Transfer Object)
 */
export interface RegisterDTO {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  username: string;
  password: string;
  role?: 'user' | 'admin';  // Optional - default 'user'
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
   * JWT token yaratish
   */
  generateToken(user: User): string {
    const payload: TokenPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    const options: SignOptions = {
      expiresIn: config.JWT_EXPIRE as StringValue, // ✅ '7d' yoki '1h' format mos
    };

    return jwt.sign(payload, config.JWT_SECRET as Secret, options);
  }

  /**
   * JWT token verify qilish
   */
  verifyToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET as Secret) as TokenPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Ro'yxatdan o'tish (Register)
   */
  async register(data: RegisterDTO): Promise<{ user: User; token: string }> {
    const existingUser = await User.findOne({ where: { username: data.username } });
    if (existingUser) throw new Error('Bu username allaqachon band');

    const existingEmail = await User.findOne({ where: { email: data.email } });
    if (existingEmail) throw new Error('Bu email allaqachon ro‘yxatdan o‘tgan');

    const existingPhone = await User.findOne({ where: { phone: data.phone } });
    if (existingPhone) throw new Error('Bu telefon raqam allaqachon ro‘yxatdan o‘tgan');

    const user = await User.create({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email,
      username: data.username,
      password: data.password,
      role: data.role || 'user',
    });

    const token = this.generateToken(user);
    return { user, token };
  }

  /**
   * Login qilish
   */
  async login(data: LoginDTO): Promise<{ user: User; token: string }> {
    const user = await User.findOne({ where: { username: data.username } });
    if (!user) throw new Error('Username yoki parol noto‘g‘ri');

    if (!user.isActive) throw new Error('Sizning hisobingiz bloklangan');

    const isPasswordValid = await user.comparePassword(data.password);
    if (!isPasswordValid) throw new Error('Username yoki parol noto‘g‘ri');

    await user.update({ lastLoginAt: new Date() });

    const token = this.generateToken(user);
    return { user, token };
  }

  /**
   * Token orqali userni topish
   */
  async getUserByToken(token: string): Promise<User | null> {
    const payload = this.verifyToken(token);
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
