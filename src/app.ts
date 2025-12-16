import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { swaggerSpec } from './config/swagger.config';
import './modules/index';


// Routes
import userRoutes from './modules/user/user.routes';
import adminRoutes from './modules/admin/admin.routes';
import automationRoutes from './modules/automationRoutes';

const app: Application = express();

/**
 * Middleware'lar
 */

app.use(
  cors({
    origin: 'http://localhost:3001',
    credentials: true,
  }),
);


// 2. Cookie Parser
app.use(cookieParser());

// 3. JSON va URL-encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Static fayllar
app.use('/uploads', express.static('uploads'));

/**
 * Swagger UI ✅ YANGI
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
      // ✅ BU MUHIM - Authorization headerni majburiy qo'shish
      requestInterceptor: (req: any) => {
        console.log('📤 Swagger request:', req.url);
        console.log('📤 Headers:', req.headers);
        return req;
      },
    },
  }),
);

/**
 * Swagger JSON endpoint ✅ YANGI
 */
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
    await connectDatabase();

    const fs = require('fs');
    const path = require('path');

    // Kerakli papkalarni yaratish
    const dirs = ['uploads', 'logs', 'screenshots', 'captchas', 'browser-data'];

    dirs.forEach((dir) => {
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
      console.log(`📚 API Docs: http://localhost:${config.PORT}/api-docs`);
      console.log(`🌍 Environment: ${config.NODE_ENV}`);
      console.log(`📅 Vaqt: ${new Date().toLocaleString()}`);
      console.log('═══════════════════════════════════════════════');
      console.log('');
      console.log('📋 Available Routes:');
      console.log('   🔐 /api/auth/*       - Authentication');
      console.log('   👨‍💼 /api/admin/*      - Admin panel');
      console.log('   🤖 /api/automation/* - Browser automation');
      console.log('   📖 /api-docs         - Swagger documentation');
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
