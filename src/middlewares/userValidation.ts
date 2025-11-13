import { z } from 'zod';

/**
 * Register validation schema
 * 
 * Bu schema register endpoint uchun request body ni validate qiladi
 */
export const registerSchema = z.object({
  firstName: z
    .string({
      message: 'Ism kiritilishi shart',
    })
    .min(2, 'Ism kamida 2 ta belgidan iborat bo\'lishi kerak')
    .max(100, 'Ism 100 ta belgidan oshmasligi kerak')
    .trim(),

  lastName: z
    .string({
      message: 'Familiya kiritilishi shart',
    })
    .min(2, 'Familiya kamida 2 ta belgidan iborat bo\'lishi kerak')
    .max(100, 'Familiya 100 ta belgidan oshmasligi kerak')
    .trim(),

  phone: z
    .string({
      message: 'Telefon raqam kiritilishi shart',
    })
    .regex(
      /^\+998[0-9]{9}$/,
      'Telefon raqam formati: +998XXXXXXXXX'
    )
    .trim(),

  email: z
    .string({
      message: 'Email kiritilishi shart',
    })
    .email('Email formati noto\'g\'ri')
    .toLowerCase()
    .trim(),

  username: z
    .string({
      message: 'Username kiritilishi shart',
    })
    .min(3, 'Username kamida 3 ta belgidan iborat bo\'lishi kerak')
    .max(50, 'Username 50 ta belgidan oshmasligi kerak')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username faqat harflar, raqamlar va _ belgisidan iborat bo\'lishi mumkin'
    )
    .toLowerCase()
    .trim(),

  password: z
    .string({
      message: 'Parol kiritilishi shart',
    })
    .min(6, 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak')
    .max(255, 'Parol 255 ta belgidan oshmasligi kerak'),

  role: z
    .enum(['user', 'admin'], {
      message: 'Role faqat "user" yoki "admin" bo\'lishi mumkin',
    })
    .optional()
    .default('user'),
});

/**
 * Login validation schema
 */
export const loginSchema = z.object({
  username: z
    .string({
      message: 'Username kiritilishi shart',
    })
    .min(1, 'Username bo\'sh bo\'lmasligi kerak')
    .trim(),

  password: z
    .string({
      message: 'Parol kiritilishi shart',
    })
    .min(1, 'Parol bo\'sh bo\'lmasligi kerak'),
});

/**
 * Change password schema
 */
export const changePasswordSchema = z.object({
  oldPassword: z
    .string({
      message: 'Eski parol kiritilishi shart',
    })
    .min(1, 'Eski parol bo\'sh bo\'lmasligi kerak'),

  newPassword: z
    .string({
      message: 'Yangi parol kiritilishi shart',
    })
    .min(6, 'Yangi parol kamida 6 ta belgidan iborat bo\'lishi kerak')
    .max(255, 'Yangi parol 255 ta belgidan oshmasligi kerak'),
});

/**
 * Update user schema (Admin uchun)
 */
export const updateUserSchema = z.object({
  firstName: z.string().min(2).max(100).trim().optional(),
  lastName: z.string().min(2).max(100).trim().optional(),
  email: z.string().email().toLowerCase().trim().optional(),
  phone: z.string().regex(/^\+998[0-9]{9}$/).trim().optional(),
  role: z.enum(['user', 'admin']).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Export qilish
 */
export const authValidation = {
  register: registerSchema,
  login: loginSchema,
  changePassword: changePasswordSchema,
  updateUser: updateUserSchema,
};

export default authValidation;