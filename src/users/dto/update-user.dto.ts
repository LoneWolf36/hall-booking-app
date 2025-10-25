import { IsEmail, IsEnum, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from './create-user.dto';

/**
 * DTO for updating existing user
 * 
 * Design Decisions:
 * 1. All fields are optional (partial updates)
 * 2. Same validation rules as CreateUserDto
 * 3. Phone number changes should be handled carefully (business logic)
 * 4. Role changes require admin permissions (enforced in service)
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @Transform(({ value }) => value?.trim())
  name?: string;

  @IsOptional()
  @IsPhoneNumber('IN', { message: 'Phone number must be a valid Indian phone number' })
  @Transform(({ value }) => value?.replace(/[\s\-\(\)]/g, ''))
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email must be valid' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be either customer or admin' })
  role?: UserRole;
}

/**
 * Why separate Update DTO?
 * 
 * 1. Flexibility: Not all fields need to be updated at once
 * 2. Validation: Same rules but everything optional
 * 3. Security: Phone/role changes can have special business logic
 * 4. API Design: PATCH endpoints expect partial updates
 */