import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser'; // ✅ YANGI!
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import './modules/index';

// Routes
import userRoutes from './modules/user/user.routes';
import adminRoutes from './modules/admin/admin.routes';

const app: Application = express();

/**
 * Middleware'lar
 */

// 1. CORS
app.use(cors({
  origin: config.isDevelopment ? '*' : ['http://localhost:3000'],
  credentials: true, // Cookie uchun kerak!
}));

// 2. Cookie Parser ✅ YANGI!
app.use(cookieParser());

// 3. JSON va URL-encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Static fayllar
app.use('/uploads', express.static('uploads'));

/**
 * Health check
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
app.use('/api/auth', userRoutes);
app.use('/api/admin', adminRoutes);

/**
 * 404
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route topilmadi: ${req.method} ${req.path}`,
  });
});

/**
 * Error handler
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
    ...(config.isDevelopment && { stack: err.stack }),
  });
});

/**
 * Server start
 */
const startServer = async () => {
  try {
    await connectDatabase();

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
 * Graceful shutdown
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

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

startServer();

export default app;