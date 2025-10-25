import { IsEmail, IsEnum, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
}

/**
 * DTO for creating a new user
 * 
 * Design Decisions:
 * 1. Phone number is required and validated for Indian format
 * 2. Email is optional (many customers don't have/provide email)
 * 3. Name is required with minimum length validation
 * 4. Role defaults to 'customer' but can be set during creation
 * 5. Phone number is normalized (removes spaces, special chars)
 */
export class CreateUserDto {
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsPhoneNumber('IN', { message: 'Phone number must be a valid Indian phone number' })
  @Transform(({ value }) => value?.replace(/[\s\-\(\)]/g, '')) // Normalize phone number
  phone: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email must be valid' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be either customer or admin' })
  role?: UserRole = UserRole.CUSTOMER;
}

/**
 * Why these validations?
 * 
 * 1. @IsPhoneNumber('IN'): Ensures Indian phone format (+91XXXXXXXXXX)
 * 2. @Transform(): Normalizes data (trim spaces, lowercase email, clean phone)
 * 3. @MinLength(2): Prevents single-character names
 * 4. @IsOptional(): Email not mandatory (Indian market reality)
 * 5. @IsEnum(): Type-safe role validation
 */