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
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Admin view with more details
 * Used for admin dashboard and internal operations
 */
export class AdminUserResponseDto extends UserResponseDto {
  tenantId: string;
  
  // Future: Add booking count, last activity, etc.
  // bookingCount?: number;
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