import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

/**
 * JWT Authentication Guard
 * 
 * Protects routes by requiring valid JWT token in Authorization header.
 * 
 * **Usage**:
 * ```typescript
 * @UseGuards(JwtAuthGuard)
 * @Get('protected')
 * async protectedRoute(@Request() req) {
 *   // req.user is available (RequestUser object)
 * }
 * ```
 * 
 * **Supports Public Routes**:
 * Use @Public() decorator to bypass authentication.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
