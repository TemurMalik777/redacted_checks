import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import './modules/index'; // Modellarni import qilish - relationshiplar o'rnatiladi

// Routes
import userRoutes from './modules/user/user.routes';
import adminRoutes from './modules/admin/admin.routes';

/**
 * Express applicationni yaratish va sozlash
 */
const app: Application = express();

/**
 * Middleware'lar - Har bir request orqali o'tadi
 */

// 1. CORS - boshqa domenlardan so'rov yuborishga ruxsat berish
app.use(cors({
  origin: config.isDevelopment ? '*' : ['http://localhost:3000'], // Frontend URL
  credentials: true,
}));

// 2. JSON va URL-encoded ma'lumotlarni parse qilish
app.use(express.json({ limit: '10mb' })); // JSON body uchun
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Form data uchun

// 3. Static fayllar - uploads papkasini ochiq qilish
app.use('/uploads', express.static('uploads'));

/**
 * Health check endpoint
 * Server ishlab turishini tekshirish uchun
 */
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: '🚀 Check Automation System API ishlamoqda!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
  });
});

/**
 * API routes
 */
app.use('/api/auth', userRoutes);      // Autentifikatsiya
app.use('/api/admin', adminRoutes);    // Admin panel
// app.use('/api/imports', importRoutes); // Excel import - keyingi bosqich
// app.use('/api/checks', checksRoutes);  // Checks CRUD - keyingi bosqich
// app.use('/api/faktura', fakturaRoutes);// Faktura CRUD - keyingi bosqich
// app.use('/api/select-checks', selectChecksRoutes); // Select checks - keyingi bosqich
// app.use('/api/automation', automationRoutes);      // Browser automation - keyingi bosqich

/**
 * 404 - Route topilmadi
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route topilmadi: ${req.method} ${req.path}`,
  });
});

/**
 * Global error handler
 * Barcha xatolarni tutish va to'g'ri javob qaytarish
 */
interface ErrorWithStatus extends Error {
  statusCode?: number;
  status?: string;
}

app.use((err: ErrorWithStatus, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Server xatosi:', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Serverda ichki xato';
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(config.isDevelopment && { stack: err.stack }), // Dev rejimida stack trace
  });
});

/**
 * Serverni ishga tushirish funktsiyasi
 */
const startServer = async () => {
  try {
    // 1. Database ga ulanish
    await connectDatabase();
    
    // 2. Kerakli papkalarni yaratish
    const fs = require('fs');
    const path = require('path');
    
    const dirs = ['uploads', 'logs', 'screenshots', 'captchas'];
    dirs.forEach(dir => {
      const dirPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 Papka yaratildi: ${dir}/`);
      }
    });
    
    // 3. Serverni ishga tushirish
    app.listen(config.PORT, () => {
      console.log('');
      console.log('═══════════════════════════════════════════════');
      console.log('🚀 Server muvaffaqiyatli ishga tushdi!');
      console.log('═══════════════════════════════════════════════');
      console.log(`📍 URL: http://localhost:${config.PORT}`);
      console.log(`🌍 Environment: ${config.NODE_ENV}`);
      console.log(`📅 Vaqt: ${new Date().toLocaleString()}`);
      console.log('═══════════════════════════════════════════════');
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Server ishga tushmadi:', error);
    process.exit(1);
  }
};

/**
 * Graceful shutdown - To'g'ri to'xtatish
 * SIGTERM yoki SIGINT signal kelganda
 */
const gracefulShutdown = async (signal: string) => {
  console.log(`\n⚠️  ${signal} signal qabul qilindi. Server to'xtatilmoqda...`);
  
  try {
    await disconnectDatabase();
    console.log('✅ Server to\'g\'ri to\'xtatildi');
    process.exit(0);
  } catch (error) {
    console.error('❌ Server to\'xtatishda xato:', error);
    process.exit(1);
  }
};

// Signal handlerlar
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Uncaught exceptionlar
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Serverni ishga tushirish
startServer();

export default app;