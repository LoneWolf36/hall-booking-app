import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, MinLength, MaxLength } from 'class-validator';

/**
 * DTO for requesting OTP for phone-based login.
 * 
 * Indian phone numbers: 10 digits, optionally prefixed with +91
 */
export class RequestOtpDto {
  @ApiProperty({
    description: 'Phone number in Indian format (10 digits or +91XXXXXXXXXX)',
    example: '+919876543210',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(/^(\+91)?[6-9]\d{9}$/, {
    message: 'Invalid Indian phone number. Must be 10 digits starting with 6-9, optionally prefixed with +91',
  })
  phone: string;

  @ApiProperty({
    description: 'Tenant ID (venue identifier)',
    example: 'tenant-uuid-here',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Tenant ID is required' })
  @MinLength(10, { message: 'Tenant ID must be at least 10 characters' })
  @MaxLength(100, { message: 'Tenant ID must not exceed 100 characters' })
  tenantId: string;
}
