import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { HealthController } from './health.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { CacheService } from '../common/services/cache.service';
import { SmsService } from '../common/services/sms.service';
import { RedisModule } from '../redis/redis.module';

/**
 * Authentication Module
 * 
 * Provides phone-based OTP authentication with JWT tokens.
 * 
 * **Features**:
 * - Phone-based OTP login with MSG91 SMS delivery
 * - JWT access tokens (15 minutes)
 * - JWT refresh tokens (7 days)
 * - Role-based access control
 * - Auto-registration on first login
 * - SMS delivery monitoring
 * 
 * **Exports**:
 * - AuthService: For manual authentication in other modules
 * - JwtAuthGuard: To protect routes
 * - RolesGuard: For role-based access control
 * - Public, Roles, CurrentUser decorators
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'super-secret-jwt-token',
        signOptions: {
          expiresIn: '15m', // Default access token expiry
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    UsersModule,
  ],
  controllers: [AuthController, HealthController],
  providers: [AuthService, JwtStrategy, CacheService, SmsService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
