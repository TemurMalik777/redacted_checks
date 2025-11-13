import rateLimit from 'express-rate-limit';

/**
 * Rate Limiter Middleware
 * 
 * API endpointlariga haddan tashqari so'rov yuborishni cheklaydi
 * Bu DDoS hujumlaridan himoya qiladi
 */

/**
 * Umumiy rate limiter
 * 15 daqiqada maksimal 100 ta request
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 daqiqa
  max: 100,                  // 100 request
  message: {
    success: false,
    message: 'Juda ko\'p so\'rov yubordingiz. Iltimos, keyinroq urinib ko\'ring.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Auth endpoints uchun qattiqroq limiter
 * 
 * Brute-force hujumlaridan himoya
 * 15 daqiqada maksimal 5 ta login/register urinishi
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 daqiqa
  max: 5,                    // 5 ta urinish
  message: {
    success: false,
    message: 'Juda ko\'p login urinishi. Iltimos, 15 daqiqadan keyin qayta urinib ko\'ring.',
  },
  skipSuccessfulRequests: true, // Muvaffaqiyatli requestlarni hisobga olmaslik
});

/**
 * Admin endpoints uchun limiter
 * 1 daqiqada maksimal 30 ta request
 */
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 daqiqa
  max: 30,             // 30 request
  message: {
    success: false,
    message: 'Juda ko\'p admin so\'rovi. Iltimos, bir oz kutib turing.',
  },
});

/**
 * File upload uchun limiter
 * 1 soatda maksimal 10 ta fayl yuklash
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 soat
  max: 10,                  // 10 upload
  message: {
    success: false,
    message: 'Juda ko\'p fayl yukladingiz. Iltimos, 1 soatdan keyin qayta urinib ko\'ring.',
  },
});

/**
 * Automation endpoints uchun limiter
 * Browser automation resurs talab qiladi
 * 1 daqiqada maksimal 5 ta automation request
 */
export const automationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 daqiqa
  max: 5,              // 5 request
  message: {
    success: false,
    message: 'Juda ko\'p automation so\'rovi. Iltimos, bir oz kutib turing.',
  },
});

export default {
  general: generalLimiter,
  auth: authLimiter,
  admin: adminLimiter,
  upload: uploadLimiter,
  automation: automationLimiter,
};