import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/services/cache.service';
import { SmsService } from '../common/services/sms.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/dto/create-user.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpResponseDto, LoginResponseDto, JwtPayload } from './dto/auth-response.dto';

/**
 * Authentication Service
 * 
 * Handles phone-based OTP authentication and JWT token generation.
 * 
 * **Features**:
 * - Phone-based OTP login (no passwords)
 * - JWT access tokens (15 minutes)
 * - JWT refresh tokens (7 days)
 * - Redis-based OTP storage
 * - Automatic user creation on first login
 * 
 * **Security**:
 * - OTPs expire after 5 minutes
 * - Rate limiting: 3 OTP requests per phone per 10 minutes
 * - OTPs are 6-digit random numbers
 * - Invalid OTP attempts are logged
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly OTP_EXPIRY_SECONDS = 300; // 5 minutes
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly MAX_OTP_ATTEMPTS = 5;
  private readonly BYPASS_OTP = '000000'; // Development bypass OTP
  private readonly isDevelopment = process.env.NODE_ENV === 'development';

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly smsService: SmsService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Request OTP for phone-based login.
   * 
   * Generates a 6-digit OTP and stores it in Redis with 5-minute expiry.
   * In production, this should send SMS via provider like Twilio/MSG91.
   * 
   * **Rate Limiting**: Max 3 OTP requests per phone per 10 minutes.
   * 
   * @param requestOtpDto - Phone number and tenant ID
   * @returns OTP response with expiry time
   * @throws {BadRequestException} - Rate limit exceeded
   */
  async requestOtp(requestOtpDto: RequestOtpDto): Promise<OtpResponseDto> {
    const { phone, tenantId } = requestOtpDto;
    const normalizedPhone = this.normalizePhoneNumber(phone);

    // Check rate limiting
    const rateLimitKey = `otp_rate_limit:${normalizedPhone}`;
    const attempts = await this.cacheService.get<string>(rateLimitKey);
    
    if (attempts && parseInt(attempts, 10) >= 3) {
      throw new BadRequestException({
        message: 'Too many OTP requests. Please try again in 10 minutes.',
        code: 'OTP_RATE_LIMIT_EXCEEDED',
      });
    }

    // Generate 6-digit OTP
    const otp = this.generateOtp();
    const otpKey = `otp:${normalizedPhone}:${tenantId}`;

    // Store OTP in Redis with 5-minute expiry
    await this.cacheService.set(otpKey, otp, this.OTP_EXPIRY_SECONDS);

    // Increment rate limit counter (10-minute window)
    const currentAttempts = attempts ? parseInt(attempts, 10) + 1 : 1;
    await this.cacheService.set(rateLimitKey, currentAttempts.toString(), 600);

    // Send OTP via SMS (MSG91 in production, console in development)
    const smsResult = await this.smsService.sendOtp(normalizedPhone, otp);
    
    if (!smsResult.success) {
      this.logger.error(`Failed to send OTP via SMS: ${smsResult.error}`);
      // Don't fail the request - OTP is still in Redis
      // In development, this will just log to console
    }

    // Development logging
    if (this.isDevelopment) {
      this.logger.log(`🔐 OTP for ${normalizedPhone}: ${otp}`);
      this.logger.log(`💡 Development bypass: Use OTP "${this.BYPASS_OTP}" to skip verification`);
    }

    this.logger.log(`OTP requested for phone ${normalizedPhone}, tenant ${tenantId}`);

    return {
      success: true,
      message: `OTP sent successfully to ${normalizedPhone}`,
      expiresIn: this.OTP_EXPIRY_SECONDS,
    };
  }

  /**
   * Verify OTP and login user.
   * 
   * Validates OTP, creates user if first login, and returns JWT tokens.
   * 
   * **Auto-Registration**: If user doesn't exist, creates customer account.
   * 
   * @param verifyOtpDto - Phone, OTP, and tenant ID
   * @returns JWT access and refresh tokens with user info
   * @throws {UnauthorizedException} - Invalid or expired OTP
   * @throws {BadRequestException} - Invalid tenant
   */
  async verifyOtpAndLogin(verifyOtpDto: VerifyOtpDto): Promise<LoginResponseDto> {
    const { phone, otp, tenantId } = verifyOtpDto;
    const normalizedPhone = this.normalizePhoneNumber(phone);

    // Verify tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new BadRequestException({
        message: 'Invalid tenant',
        code: 'INVALID_TENANT',
      });
    }

    // Retrieve and verify OTP
    const otpKey = `otp:${normalizedPhone}:${tenantId}`;
    const storedOtp = await this.cacheService.get<string>(otpKey);

    // Development bypass: Allow "000000" to skip OTP verification
    if (this.isDevelopment && otp === this.BYPASS_OTP) {
      this.logger.warn(`⚠️  Development bypass used for ${normalizedPhone}`);
      // Continue to user lookup/creation (skip OTP deletion)
    } else {
      // Normal OTP verification
      if (!storedOtp) {
        throw new UnauthorizedException({
          message: 'OTP expired or not found. Please request a new OTP.',
          code: 'OTP_EXPIRED',
        });
      }

      if (storedOtp !== otp) {
        // Increment failed attempts
        const attemptsKey = `otp_attempts:${normalizedPhone}:${tenantId}`;
        const attempts = await this.cacheService.get<string>(attemptsKey);
        const currentAttempts = attempts ? parseInt(attempts, 10) + 1 : 1;
        
        await this.cacheService.set(attemptsKey, currentAttempts.toString(), this.OTP_EXPIRY_SECONDS);

        if (currentAttempts >= this.MAX_OTP_ATTEMPTS) {
          // Invalidate OTP after max attempts
          await this.cacheService.delete(otpKey);
          throw new UnauthorizedException({
            message: 'Too many failed attempts. Please request a new OTP.',
            code: 'MAX_OTP_ATTEMPTS_EXCEEDED',
          });
        }

        throw new UnauthorizedException({
          message: `Invalid OTP. ${this.MAX_OTP_ATTEMPTS - currentAttempts} attempts remaining.`,
          code: 'INVALID_OTP',
        });
      }

      // OTP is valid - delete it (one-time use)
      await this.cacheService.delete(otpKey);
    }

    // Find or create user
    let user = await this.usersService.findByPhone(tenantId, normalizedPhone);

    if (!user) {
      // Auto-register customer on first login
      user = await this.usersService.upsertUserByPhone(tenantId, {
        phone: normalizedPhone,
        name: `User ${normalizedPhone.slice(-4)}`, // Default name: "User 3210"
        role: UserRole.CUSTOMER,
      });

      this.logger.log(`New user auto-registered: ${user.id} (${normalizedPhone})`);
    }

    // Generate JWT tokens
    const tokens = await this.generateTokens(user);

    this.logger.log(`User ${user.id} logged in successfully`);

    return {
      ...tokens,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        tenantId,
        email: user.email,
      },
    };
  }

  /**
   * Refresh access token using refresh token.
   * 
   * @param refreshToken - Valid JWT refresh token
   * @returns New access token
   * @throws {UnauthorizedException} - Invalid or expired refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken);

      // Verify user still exists and is active
      const user = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          tenantId: payload.tenantId,
        },
      });

      if (!user) {
        throw new UnauthorizedException({
          message: 'User not found or inactive',
          code: 'USER_NOT_FOUND',
        });
      }

      // Generate new access token
      const newPayload: JwtPayload = {
        sub: user.id,
        phone: user.phone,
        tenantId: payload.tenantId,
        role: user.role,
      };

      const accessToken = this.jwtService.sign(newPayload, {
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
      });

      return {
        accessToken,
        expiresIn: 900, // 15 minutes
      };
    } catch (error) {
      throw new UnauthorizedException({
        message: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }
  }

  /**
   * Validate JWT payload and return user info.
   * 
   * Used by JwtStrategy for request authentication.
   * 
   * @param payload - JWT payload from token
   * @returns User information
   * @throws {UnauthorizedException} - User not found
   */
  async validateUser(payload: JwtPayload) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tenantId,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    return {
      userId: user.id,
      phone: user.phone,
      tenantId: payload.tenantId,
      role: user.role,
      name: user.name,
    };
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  /**
   * Generate JWT access and refresh tokens.
   * 
   * @param user - User object
   * @returns Access and refresh tokens with expiry
   * @private
   */
  private async generateTokens(user: {
    id: string;
    phone: string;
    role: string;
  }): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const payload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      tenantId: user['tenantId'], // TypeScript doesn't know about tenantId
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: this.ACCESS_TOKEN_EXPIRY }),
      this.jwtService.signAsync(payload, { expiresIn: this.REFRESH_TOKEN_EXPIRY }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  /**
   * Generate 6-digit random OTP.
   * 
   * @returns 6-digit OTP string
   * @private
   */
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Normalize phone number to +91XXXXXXXXXX format.
   * 
   * @param phone - Phone number in any format
   * @returns Normalized phone number
   * @private
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters except +
    let normalized = phone.replace(/[^\d+]/g, '');

    // Add +91 if not present and number is 10 digits
    if (!normalized.startsWith('+91') && normalized.length === 10) {
      normalized = `+91${normalized}`;
    }

    return normalized;
  }
}
