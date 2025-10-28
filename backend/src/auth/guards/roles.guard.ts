import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/dto/create-user.dto';

/**
 * Role-Based Access Control Guard
 * 
 * Restricts route access based on user roles.
 * 
 * **Usage**:
 * ```typescript
 * @Roles(UserRole.ADMIN)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Get('admin-only')
 * async adminRoute() {
 *   // Only accessible by admin users
 * }
 * ```
 * 
 * **Multiple Roles**: User must have at least one of the specified roles.
 * ```typescript
 * @Roles(UserRole.ADMIN, UserRole.STAFF)
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from @Roles() decorator
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles specified, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if user has any of the required roles
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException({
        message: `Access denied. Required roles: ${requiredRoles.join(', ')}`,
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    return true;
  }
}
