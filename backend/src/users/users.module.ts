import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ValidationService } from '../common/services/validation.service';

/**
 * Users Module - Updated to include centralized validation
 * 
 * Now includes ValidationService dependency to use centralized
 * validation logic instead of duplicate validation code.
 */
@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    ValidationService, // Added centralized validation
  ],
  exports: [UsersService],
})
export class UsersModule {}