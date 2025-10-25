import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RedisService } from '../redis/redis.service';
import { PrismaClient } from '@prisma/client';
@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly prisma = new PrismaClient();
  constructor(private readonly redisService: RedisService) {}
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async check() {
    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0'
    };
    const isHealthy = checks.database.healthy && checks.redis.healthy;
    return {
      status: isHealthy ? 'ok' : 'error',
      checks
    };
  }
  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { healthy: true, message: 'Connected' };
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return { healthy: false, message: error.message };
    }
  }
  private async checkRedis() {
    try {
      const testKey = 'health-check';
      await this.redisService.set(testKey, 'ok', 10);
      const result = await this.redisService.get(testKey);
      await this.redisService.del(testKey);
      return { 
        healthy: result === 'ok', 
        message: result === 'ok' ? 'Connected' : 'Connection failed' 
      };
    } catch (error) {
      this.logger.error('Redis health check failed', error);
      return { healthy: false, message: error.message };
    }
  }
}
