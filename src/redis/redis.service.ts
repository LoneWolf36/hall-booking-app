import { Injectable, Logger } from '@nestjs/common';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly redis: Redis;

  constructor() {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error('Upstash Redis environment variables not set');
    }

    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    this.logger.log('Upstash Redis initialized');
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      this.logger.log(`Redis SET key=${key}, value=${value}, ttl=${ttlSeconds}`);
      if (ttlSeconds) {
        await this.redis.set(key, value, { ex: ttlSeconds });
      } else {
        await this.redis.set(key, value);
      }
    } catch (error) {
      this.logger.error(`Redis SET failed for key: ${key}`, error);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.logger.error(`Redis GET failed for key: ${key}`, error);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Redis DEL failed for key: ${key}`, error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result > 0;
    } catch (error) {
      this.logger.error(`Redis EXISTS failed for key: ${key}`, error);
      return false;
    }
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    try {
      const newValue = await this.redis.incr(key);
      if (newValue === 1 && ttlSeconds) {
        await this.redis.expire(key, ttlSeconds);
      }
      return newValue;
    } catch (error) {
      this.logger.error(`Redis INCR failed for key: ${key}`, error);
      throw error;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.redis.expire(key, ttlSeconds);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis EXPIRE failed for key: ${key}`, error);
      throw error;
    }
  }

  async setJSON(key: string, obj: any, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(obj), ttlSeconds);
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;

    try {
      // Handle both cases: if Upstash already returned an object or a string
      if (typeof value === 'object') {
        return value as T;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`JSON parse failed for key: ${key}`, error);
      return null;
    }
  }

  async healthCheck(): Promise<{ status: string; latency: number }> {
    const start = Date.now();
    try {
      await this.redis.ping();
      const latency = Date.now() - start;
      return { status: 'healthy', latency };
    } catch {
      return { status: 'unhealthy', latency: Date.now() - start };
    }
  }
}