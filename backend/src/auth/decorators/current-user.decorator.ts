import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '../dto/auth-response.dto';

/**
 * Current User decorator.
 * 
 * Extracts authenticated user from request object.
 * 
 * **Usage**:
 * ```typescript
 * @UseGuards(JwtAuthGuard)
 * @Get('profile')
 * getProfile(@CurrentUser() user: RequestUser) {
 *   return { user };
 * }
 * ```
 * 
 * **Extract Specific Field**:
 * ```typescript
 * @Get('my-bookings')
 * getBookings(@CurrentUser('userId') userId: string) {
 *   return this.bookings.findByUser(userId);
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext): RequestUser | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
