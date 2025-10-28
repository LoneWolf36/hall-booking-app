import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/dto/create-user.dto';

/**
 * Roles decorator for RBAC.
 * 
 * Specifies which roles can access a route.
 * Must be used with @UseGuards(JwtAuthGuard, RolesGuard).
 * 
 * **Usage**:
 * ```typescript
 * @Roles(UserRole.ADMIN)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Get('admin')
 * adminOnly() {
 *   return { message: 'Admin access granted' };
 * }
 * ```
 * 
 * **Multiple Roles**: User needs at least one role
 * ```typescript
 * @Roles(UserRole.ADMIN, UserRole.STAFF)
 * ```
 */
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
