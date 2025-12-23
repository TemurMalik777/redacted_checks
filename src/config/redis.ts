import Redis from 'ioredis';
import config from './env';

/**
 * Redis client konfiguratsiyasi
 */
const redisConfig = {
  host: config.REDIS_HOST || 'localhost',
  port: config.REDIS_PORT || 6379,
  password: config.REDIS_PASSWORD || undefined,
  db: config.REDIS_DB || 0,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
};

/**
 * Redis client instance
 */
export const redis = new Redis(redisConfig);

/**
 * Redis connection events
 */
redis.on('connect', () => {
  console.log('🔌 Redis ulanish boshlandi...');
});

redis.on('ready', () => {
  console.log('✅ Redis tayyor!');
});

redis.on('error', (error) => {
  console.error('❌ Redis xatosi:', error);
});

redis.on('close', () => {
  console.log('👋 Redis ulanishi yopildi');
});

/**
 * Redis ulanishini tekshirish
 */
export const testRedisConnection = async (): Promise<boolean> => {
  try {
    await redis.ping();
    console.log('✅ Redis connection test muvaffaqiyatli!');
    return true;
  } catch (error) {
    console.error('❌ Redis connection test xatosi:', error);
    return false;
  }
};

/**
 * Redis ni graceful shutdown
 */
export const closeRedis = async (): Promise<void> => {
  try {
    await redis.quit();
    console.log('✅ Redis to\'g\'ri yopildi');
  } catch (error) {
    console.error('❌ Redis yopishda xato:', error);
  }
};

export default redis;