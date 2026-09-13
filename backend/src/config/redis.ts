import Redis, { RedisOptions } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const connectionString =
  (process.env.REDIS_URL && process.env.REDIS_URL.trim()) ||
  (process.env.REDIS_HOST && (process.env.REDIS_HOST.startsWith('redis://') || process.env.REDIS_HOST.startsWith('rediss://'))
    ? process.env.REDIS_HOST.trim()
    : undefined);

export const redisConnection = connectionString
  ? new Redis(connectionString, { maxRetriesPerRequest: null })
  : new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    });

export const redisOptions: RedisOptions = redisConnection.options;


