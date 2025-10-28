import { SetMetadata } from '@nestjs/common';

/**
 * Public route decorator.
 * 
 * Marks a route as public, bypassing JWT authentication.
 * 
 * **Usage**:
 * ```typescript
 * @Public()
 * @Get('health')
 * healthCheck() {
 *   return { status: 'ok' };
 * }
 * ```
 */
export const Public = () => SetMetadata('isPublic', true);
