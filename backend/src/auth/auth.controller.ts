import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpResponseDto, LoginResponseDto } from './dto/auth-response.dto';

/**
 * Authentication Controller
 * 
 * Handles phone-based OTP authentication endpoints.
 * 
 * **Endpoints**:
 * - POST /auth/request-otp - Request OTP for phone
 * - POST /auth/verify-otp - Verify OTP and login
 * - POST /auth/refresh - Refresh access token
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Request OTP for phone-based login.
   * 
   * Sends a 6-digit OTP to the provided phone number.
   * OTP expires in 5 minutes.
   * 
   * Rate limit: 3 requests per phone per 10 minutes.
   */
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request OTP for phone-based login',
    description: 'Sends a 6-digit OTP to the phone number. OTP expires in 5 minutes.',
  })
  @ApiBody({ type: RequestOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    type: OtpResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid phone or rate limit exceeded',
  })
  async requestOtp(@Body() requestOtpDto: RequestOtpDto): Promise<OtpResponseDto> {
    return this.authService.requestOtp(requestOtpDto);
  }

  /**
   * Verify OTP and login.
   * 
   * Validates the OTP and returns JWT access and refresh tokens.
   * Auto-registers user if first login.
   */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP and login',
    description: 'Validates OTP and returns JWT tokens. Auto-registers user on first login.',
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or expired OTP',
  })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto): Promise<LoginResponseDto> {
    return this.authService.verifyOtpAndLogin(verifyOtpDto);
  }

  /**
   * Refresh access token.
   * 
   * Uses refresh token to generate a new access token.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Uses refresh token to generate new access token',
  })
  @ApiBody({
    schema: {
      properties: {
        refreshToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Access token refreshed',
    schema: {
      properties: {
        accessToken: { type: 'string' },
        expiresIn: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid refresh token',
  })
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshAccessToken(refreshToken);
  }
}
