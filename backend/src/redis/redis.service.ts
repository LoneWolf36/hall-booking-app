import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private redis: Redis | null = null;
  private isConnected = false;

  constructor() {
    this.initializeRedis();
  }

  async onModuleInit() {
    await this.testConnection();
  }

  private initializeRedis() {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
      this.logger.error(
        'Redis configuration missing. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.'
      );
      this.logger.warn(
        'Redis functionality will be disabled. The application will continue to work but without caching.'
      );
      return;
    }

    try {
      this.redis = new Redis({
        url: redisUrl,
        token: redisToken,
        retry: {
          retries: 3,
          backoff: (retryCount) => Math.min(1000 * 2 ** retryCount, 10000)
        }
      });
      
      this.logger.log('Redis client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Redis client:', error);
      this.redis = null;
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.redis) {
      this.isConnected = false;
      return;
    }

    try {
      await this.redis.ping();
      this.isConnected = true;
      this.logger.log('Redis connection established successfully');
    } catch (error) {
      this.isConnected = false;
      this.logger.error('Redis connection test failed:', error);
    }
  }

  private ensureConnection(): void {
    if (!this.redis) {
      throw new Error('Redis client is not initialized. Check your environment configuration.');
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.ensureConnection();
    
    try {
      this.logger.debug(`Redis SET key=${key}, ttl=${ttlSeconds}`);
      if (ttlSeconds) {
        await this.redis!.set(key, value, { ex: ttlSeconds });
      } else {
        await this.redis!.set(key, value);
      }
    } catch (error) {
      this.logger.error(`Redis SET failed for key: ${key}`, error);
      throw new Error(`Failed to set cache value: ${error.message}`);
    }
  }

  async get(key: string): Promise<string | null> {
    this.ensureConnection();
    
    try {
      return await this.redis!.get(key);
    } catch (error) {
      this.logger.error(`Redis GET failed for key: ${key}`, error);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    this.ensureConnection();
    
    try {
      await this.redis!.del(key);
    } catch (error) {
      this.logger.error(`Redis DEL failed for key: ${key}`, error);
      throw new Error(`Failed to delete cache value: ${error.message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    this.ensureConnection();
    
    try {
      const result = await this.redis!.exists(key);
      return result > 0;
    } catch (error) {
      this.logger.error(`Redis EXISTS failed for key: ${key}`, error);
      return false;
    }
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    this.ensureConnection();
    
    try {
      const newValue = await this.redis!.incr(key);
      if (newValue === 1 && ttlSeconds) {
        await this.redis!.expire(key, ttlSeconds);
      }
      return newValue;
    } catch (error) {
      this.logger.error(`Redis INCR failed for key: ${key}`, error);
      throw new Error(`Failed to increment cache value: ${error.message}`);
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    this.ensureConnection();
    
    try {
      const result = await this.redis!.expire(key, ttlSeconds);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis EXPIRE failed for key: ${key}`, error);
      throw new Error(`Failed to set cache expiration: ${error.message}`);
    }
  }

  async setJSON(key: string, obj: any, ttlSeconds?: number): Promise<void> {
    const jsonString = JSON.stringify(obj);
    await this.set(key, jsonString, ttlSeconds);
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

  async healthCheck(): Promise<{ 
    status: string; 
    latency: number; 
    connected: boolean;
    message?: string;
  }> {
    if (!this.redis) {
      return {
        status: 'unavailable',
        latency: 0,
        connected: false,
        message: 'Redis client not initialized - check environment variables'
      };
    }

    const start = Date.now();
    try {
      await this.redis.ping();
      const latency = Date.now() - start;
      this.isConnected = true;
      return { 
        status: 'healthy', 
        latency,
        connected: true
      };
    } catch (error) {
      const latency = Date.now() - start;
      this.isConnected = false;
      return { 
        status: 'unhealthy', 
        latency,
        connected: false,
        message: `Connection failed: ${error.message}`
      };
    }
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Force reconnection attempt
   */
  async reconnect(): Promise<void> {
    this.logger.log('Attempting to reconnect to Redis...');
    this.initializeRedis();
    await this.testConnection();
  }
}