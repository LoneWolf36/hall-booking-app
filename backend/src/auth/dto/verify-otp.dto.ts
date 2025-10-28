import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, Length } from 'class-validator';

/**
 * DTO for verifying OTP and logging in.
 * 
 * After successful verification, returns JWT access and refresh tokens.
 */
export class VerifyOtpDto {
  @ApiProperty({
    description: 'Phone number that received the OTP',
    example: '+919876543210',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(/^(\+91)?[6-9]\d{9}$/, {
    message: 'Invalid Indian phone number',
  })
  phone: string;

  @ApiProperty({
    description: '6-digit OTP code',
    example: '123456',
    required: true,
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'OTP code is required' })
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must contain only digits' })
  otp: string;

  @ApiProperty({
    description: 'Tenant ID',
    example: 'tenant-uuid-here',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Tenant ID is required' })
  tenantId: string;
}
