import winston from 'winston';
import path from 'path';

/**
 * Logger Configuration
 * Winston logger bilan ishlash uchun
 */

// Log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.printf(({ level, message, timestamp, stack }) => {
        if (stack) {
            return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
        }
        return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
);

// Logger instance
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        // Console transport
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                logFormat
            )
        }),
        
        // File transport - Error logs
        new winston.transports.File({
            filename: path.join('logs', 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        
        // File transport - Combined logs
        new winston.transports.File({
            filename: path.join('logs', 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        
        // File transport - Info logs
        new winston.transports.File({
            filename: path.join('logs', 'app.log'),
            level: 'info',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    ],
});

/**
 * Helper functions for logging
 */

export const logInfo = (message: string, ...meta: any[]): void => {
    logger.info(message, ...meta);
};

export const logError = (message: string, error?: Error | unknown, ...meta: any[]): void => {
    if (error instanceof Error) {
        logger.error(message, { error: error.message, stack: error.stack, ...meta });
    } else {
        logger.error(message, { error, ...meta });
    }
};

export const logWarn = (message: string, ...meta: any[]): void => {
    logger.warn(message, ...meta);
};

export const logDebug = (message: string, ...meta: any[]): void => {
    logger.debug(message, ...meta);
};

/**
 * Create logs directory if it doesn't exist
 */
import fs from 'fs';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Export default logger
export default logger;