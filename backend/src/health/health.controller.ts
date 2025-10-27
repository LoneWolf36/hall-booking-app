import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CacheService } from '../common/services/cache.service';
import { PrismaClient } from '../../generated/prisma';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly prisma = new PrismaClient();
  constructor(private readonly cacheService: CacheService) {}
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async check() {
    const checks = {
      database: await this.checkDatabase(),
      cache: await this.checkCache(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0'
    };
    const isHealthy = checks.database.healthy && checks.cache.healthy;
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
  private async checkCache() {
    try {
      const testKey = 'health-check';
      await this.cacheService.set(testKey, 'ok', 10);
      const result = await this.cacheService.get<string>(testKey);
      await this.cacheService.delete(testKey);
      return { 
        healthy: result === 'ok', 
        message: result === 'ok' ? 'Connected' : 'Connection failed' 
      };
    } catch (error) {
      this.logger.error('Cache health check failed', error);
      return { healthy: false, message: error.message };
    }
  }
}
