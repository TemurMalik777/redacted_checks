import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/env';
// import { connectDatabase, disconnectDatabase } from './config/database';
import { initializeDatabase } from './database/database';
import { closeDatabase } from './config/database';
import { swaggerSpec } from './config/swagger.config';

// redis
import { testRedisConnection, closeRedis } from './config/redis';

// Routes
import userRoutes from './modules/user/user.routes';
import adminRoutes from './modules/admin/admin.routes';
import automationRoutes from './modules/automation/automation.routes';
import checksRoutes from './modules/checks/checks.routes';

const app: Application = express();

/**
 * Middleware'lar
 */
const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

/**
 * Swagger UI
 */
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Check Automation API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      syntaxHighlight: {
        activate: true,
        theme: 'monokai',
      },
      requestInterceptor: (req: any) => {
        console.log('📤 Swagger request:', req.url);
        console.log('📤 Headers:', req.headers);
        return req;
      },
    },
  }),
);

app.get('/api-docs.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

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
    docs: `http://localhost:${config.PORT}/api-docs`,
  });
});

/**
 * API routes
 */
app.use('/api/auth', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/checks', checksRoutes);

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

app.use(
  (err: ErrorWithStatus, req: Request, res: Response, next: NextFunction) => {
    console.error('❌ Server xatosi:', err);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Serverda ichki xato';

    res.status(statusCode).json({
      success: false,
      message,
      ...(config.isDevelopment && { stack: err.stack }),
    });
  },
);

/**
 * Server start
 */
const startServer = async () => {
  try {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('🚀 Server ishga tushmoqda...');
    console.log('═══════════════════════════════════════════════\n');

    // 1. Database initialization
    console.log('📊 1/3: Database ulanishi...');
    await initializeDatabase();

    // 2. Redis initialization ✅ YANGI
    console.log('\n🔴 2/3: Redis ulanishi...');
    const redisConnected = await testRedisConnection();
    if (!redisConnected) {
      console.error("\n❌ Redis ga ulanib bo'lmadi!");
      console.error('\nIltimos tekshiring:');
      console.error('  1. Redis server ishlab turibmi?');
      console.error('     Docker: docker ps | grep redis');
      console.error('     Local: sudo systemctl status redis');
      console.error("  2. .env fayldagi Redis sozlamalari to'g'ri?");
      console.error(`     REDIS_HOST=${config.REDIS_HOST}`);
      console.error(`     REDIS_PORT=${config.REDIS_PORT}\n`);
      throw new Error('Redis connection failed');
    }

    // 3. Papkalarni yaratish
    console.log('\n📁 3/3: Kerakli papkalarni yaratish...');
    const fs = require('fs');
    const path = require('path');

    const dirs = ['uploads', 'logs', 'screenshots', 'captchas', 'browser-data'];

    dirs.forEach((dir) => {
      const dirPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`   ✅ ${dir}/`);
      } else {
        console.log(`   ✓ ${dir}/ (mavjud)`);
      }
    });

    // 4. Express server ni boshlash
    app.listen(config.PORT, () => {
      console.log('');
      console.log('═══════════════════════════════════════════════');
      console.log('✅ SERVER TAYYOR!');
      console.log('═══════════════════════════════════════════════');
      console.log(`📍 URL:          http://localhost:${config.PORT}`);
      console.log(`📚 API Docs:     http://localhost:${config.PORT}/api-docs`);
      console.log(`🌍 Environment:  ${config.NODE_ENV}`);
      console.log(`📊 Database:     PostgreSQL (${config.DB_NAME})`);
      console.log(`🔴 Redis:        ${config.REDIS_HOST}:${config.REDIS_PORT}`);
      console.log(`📅 Vaqt:         ${new Date().toLocaleString('uz-UZ')}`);
      console.log('═══════════════════════════════════════════════');
      console.log('');
      console.log('📋 Available Routes:');
      console.log('   🔐 /api/auth/*       - Authentication');
      console.log('   👨‍💼 /api/admin/*      - Admin panel');
      console.log(
        '   🤖 /api/automation/* - Browser automation (Redis sessions)',
      );
      console.log('   📝 /api/checks/*     - Checks management');
      console.log('   📖 /api-docs         - Swagger documentation');
      console.log('═══════════════════════════════════════════════');
      console.log('');
    });
  } catch (error) {
    console.error('\n❌ Server ishga tushmadi:', error);
    console.error(
      '\nXatolik tafsilotlari:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
};

/**
 * Graceful shutdown
 */
const gracefulShutdown = async (signal: string) => {
  console.log(`\n⚠️  ${signal} signal qabul qilindi. Server to'xtatilmoqda...`);

  try {
    console.log('1️⃣  Redis ulanishini yopish...');
    await closeRedis(); // ✅ YANGI - Redis birinchi yopiladi

    console.log('2️⃣  Database ulanishini yopish...');
    await closeDatabase();

    console.log("✅ Server to'g'ri to'xtatildi");
    process.exit(0);
  } catch (error) {
    console.error("❌ Server to'xtatishda xato:", error);
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
