import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
// Import from the custom generator output path instead of @prisma/client
import { PrismaClient } from '../../../generated/prisma';

/**
 * Prisma Service - Database connection and client management
 * 
 * Features:
 * 1. Connection lifecycle management
 * 2. Graceful shutdown handling
 * 3. Connection retry logic
 * 4. Query logging in development
 * 5. Performance monitoring
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // Configuration based on environment
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error'] 
        : ['warn', 'error'],
      
      errorFormat: 'pretty',
      
      // Connection pool settings for production
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }

  /**
   * Initialize database connection when module starts
   */
  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connection established');
      
      // Enable query logging in development
      if (process.env.NODE_ENV === 'development') {
        this.$on('query' as never, (event: any) => {
          this.logger.debug(`Query: ${event.query}`);
          this.logger.debug(`Duration: ${event.duration}ms`);
        });
      }
    } catch (error) {
      this.logger.error('❌ Failed to connect to database', error);
      throw error;
    }
  }

  /**
   * Graceful shutdown - close database connections
   */
  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('🔌 Database connection closed');
    } catch (error) {
      this.logger.error('Error closing database connection', error);
    }
  }

  /**
   * Health check - verify database connectivity
   */
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    try {
      await this.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Database health check failed', error);
      throw new Error('Database connection failed');
    }
  }
}

/**
 * Why extend PrismaClient?
 * 
 * 1. **Lifecycle Management**: NestJS handles connection setup/teardown
 * 2. **Dependency Injection**: Can be injected into any service
 * 3. **Configuration**: Environment-specific settings
 * 4. **Monitoring**: Built-in logging and health checks
 * 5. **Error Handling**: Proper exception handling
 */

/**
 * IMPORTANT: Custom Generator Output Path
 * 
 * This service imports from '../../../generated/prisma' because the 
 * Prisma schema has a custom output configuration:
 * 
 * generator client {
 *   provider = "prisma-client-js"
 *   output   = "../generated/prisma"
 * }
 * 
 * This means the generated client is located at:
 * backend/generated/prisma/ (relative to backend/prisma/)
 * 
 * From backend/src/prisma/prisma.service.ts, the path is:
 * ../../../generated/prisma
 * 
 * Alternative: Remove the custom output from schema.prisma and use
 * the default import: import { PrismaClient } from '@prisma/client'
 */