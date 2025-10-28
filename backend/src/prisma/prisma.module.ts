import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Prisma Module - Global database service module
 *
 * Design Decisions:
 * 1. @Global decorator makes it available throughout the app
 * 2. No need to import in every module that needs database access
 * 3. Single instance per application (singleton)
 * 4. Exports PrismaService for dependency injection
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

/**
 * Why @Global?
 *
 * 1. **Convenience**: No need to import in every module
 * 2. **Singleton**: Single database connection pool
 * 3. **Performance**: Avoid multiple connection instances
 * 4. **Consistency**: Same configuration across the app
 */
