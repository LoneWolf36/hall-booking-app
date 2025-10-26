import { IsEmail, IsEnum, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from './create-user.dto';

/**
 * DTO for updating an existing user
 * All fields are optional since we support partial updates
 * 
 * Design Decisions:
 * 1. All validation rules same as CreateUserDto but optional
 * 2. Supports partial updates (PATCH semantics)
 * 3. Same normalization transforms as create
 * 4. Role changes are allowed (admin can promote customers)
 */
export class UpdateUserDto {
  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
    minLength: 2,
    required: false
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiProperty({
    description: 'Indian phone number with country code',
    example: '+919876543210',
    required: false
  })
  @IsOptional()
  @IsPhoneNumber('IN', { message: 'Phone number must be a valid Indian phone number' })
  @Transform(({ value }) => value?.replace(/[\s\-\(\)]/g, ''))
  phone?: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@example.com',
    required: false
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email must be valid' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiProperty({
    description: 'User role in the system',
    enum: UserRole,
    example: UserRole.CUSTOMER,
    required: false
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be either customer or admin' })
  role?: UserRole;
}

/**
 * Update Strategy:
 * 
 * 1. **Partial Updates**: Only provided fields are updated
 * 2. **Validation**: Same rules as create, but all optional
 * 3. **Normalization**: Same transforms to maintain consistency
 * 4. **Role Management**: Admins can change user roles
 * 5. **Phone/Email Uniqueness**: Validated at service layer
 */