import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for OTP request response.
 */
export class OtpResponseDto {
  @ApiProperty({
    description: 'Whether OTP was sent successfully',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'OTP sent successfully to +919876543210',
  })
  message: string;

  @ApiProperty({
    description: 'OTP expiration time in seconds',
    example: 300,
  })
  expiresIn: number;
}

/**
 * DTO for login response with JWT tokens.
 */
export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT access token (15 minutes validity)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token (7 days validity)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Token type',
    example: 'Bearer',
  })
  tokenType: string;

  @ApiProperty({
    description: 'Access token expiration time in seconds',
    example: 900,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'User information',
    example: {
      id: 'user-uuid',
      phone: '+919876543210',
      name: 'John Doe',
      role: 'customer',
      tenantId: 'tenant-uuid',
    },
  })
  user: {
    id: string;
    phone: string;
    name: string;
    role: string;
    tenantId: string;
    email?: string;
  };
}

/**
 * JWT Payload structure.
 */
export interface JwtPayload {
  sub: string; // User ID
  phone: string;
  tenantId: string;
  role: string;
  iat?: number; // Issued at
  exp?: number; // Expiration
}

/**
 * Request user object (attached to req.user after authentication).
 */
export interface RequestUser {
  userId: string;
  phone: string;
  tenantId: string;
  role: string;
  name?: string;
}
