import winston from 'winston';
import path from 'path';
import DailyRotateFile from 'winston-daily-rotate-file';

const logDir = path.join(__dirname, '../../logs');

// Custom format for better readability
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if exists
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      ),
    }),
    
    // Daily rotate file for all logs
    new DailyRotateFile({
      dirname: logDir,
      filename: 'application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
    
    // Separate file for errors
    new DailyRotateFile({
      dirname: logDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
    }),
    
    // Separate file for migrations
    new DailyRotateFile({
      dirname: path.join(logDir, 'migrations'),
      filename: 'migration-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '30d',
    }),
  ],
});

// ✅ YANGI: Har bir bosqich uchun alohida logger (GLOBAL, faqat 1 marta yaratiladi)
const stageLoggers: { [key: number]: winston.Logger } = {};

export const createStageLogger = (stage: 1 | 2 | 3 | 4 | 5 | 6) => {
  // ✅ Agar logger mavjud bo'lsa, uni qaytarish (yangi yaratmaslik)
  if (stageLoggers[stage]) {
    return stageLoggers[stage];
  }

  const stageNames = {
    1: 'bosqich-1-aniq-teng',
    2: 'bosqich-2-bitta-0-3-kop',
    3: 'bosqich-3-bitta-0-2-kam',
    4: 'bosqich-4-kop-0-3-kop',
    5: 'bosqich-5-kop-0-2-kam',
    6: 'bosqich-6-hammasi'
  };

  // ✅ Yangi logger yaratish va saqlash
  stageLoggers[stage] = winston.createLogger({
    level: 'info',
    format: customFormat,
    transports: [
      new DailyRotateFile({
        dirname: path.join(logDir, 'stages'),
        filename: `${stageNames[stage]}-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
      }),
    ],
  });

  return stageLoggers[stage];
};

export default logger;