import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for user API responses
 * 
 * Design Decisions:
 * 1. Excludes sensitive internal data (tenantId, internal IDs)
 * 2. Includes only public-safe user information
 * 3. Consistent API response format
 * 4. Easy to extend for different user contexts (admin vs customer view)
 */
export class UserResponseDto {
  @ApiProperty({
    description: 'Unique user identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid'
  })
  id: string;

  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe'
  })
  name: string;

  @ApiProperty({
    description: 'Phone number with country code',
    example: '+919876543210'
  })
  phone: string;

  @ApiProperty({
    description: 'Email address (optional)',
    example: 'john.doe@example.com',
    required: false
  })
  email?: string;

  @ApiProperty({
    description: 'User role in the system',
    example: 'customer',
    enum: ['customer', 'admin']
  })
  role: string;

  @ApiProperty({
    description: 'User creation timestamp',
    example: '2024-12-20T10:30:00.000Z',
    format: 'date-time'
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-12-20T15:45:00.000Z',
    format: 'date-time'
  })
  updatedAt: Date;
}

/**
 * Admin view with more details
 * Used for admin dashboard and internal operations
 */
export class AdminUserResponseDto extends UserResponseDto {
  @ApiProperty({
    description: 'Tenant identifier (admin only)',
    example: '123e4567-e89b-12d3-a456-426614174001',
    format: 'uuid'
  })
  tenantId: string;
  
  // Future: Add booking count, last activity, etc.
  // @ApiProperty({ description: 'Number of bookings made by user', example: 5, required: false })
  // bookingCount?: number;
  
  // @ApiProperty({ description: 'Last activity timestamp', format: 'date-time', required: false })
  // lastActiveAt?: Date;
}

/**
 * Why separate response DTOs?
 * 
 * 1. Security: Never expose internal fields like tenantId to customers
 * 2. Flexibility: Different views for different user roles
 * 3. API Consistency: Predictable response format
 * 4. Future-proof: Easy to add computed fields (booking count, etc.)
 */