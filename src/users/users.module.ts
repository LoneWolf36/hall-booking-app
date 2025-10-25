import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module'; // Assuming Prisma module exists

/**
 * Users Module - Dependency injection configuration
 * 
 * Module Design:
 * 1. Imports PrismaModule for database access
 * 2. Provides UsersService as a service
 * 3. Exports UsersService for use in other modules
 * 4. Registers UsersController for HTTP endpoints
 */
@Module({
  imports: [
    PrismaModule, // Database access
    // Future: Add RedisModule for caching
    // Future: Add AuthModule for authentication
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [
    UsersService, // Export for use in other modules (bookings, payments, etc.)
  ],
})
export class UsersModule {}

/**
 * Why this module structure?
 * 
 * 1. **Separation of Concerns**: Each module handles its domain
 * 2. **Dependency Injection**: NestJS manages service lifecycle
 * 3. **Reusability**: Other modules can import UsersService
 * 4. **Testing**: Easy to mock dependencies in tests
 * 5. **Scalability**: Can add features without breaking existing code
 */