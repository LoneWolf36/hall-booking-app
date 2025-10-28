import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { JwtPayload, RequestUser } from '../dto/auth-response.dto';

/**
 * JWT Authentication Strategy
 * 
 * Validates JWT tokens and attaches user info to request object.
 * 
 * **Token Extraction**: From Authorization header as Bearer token.
 * **Validation**: Verifies signature and expiration, then validates user exists.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'super-secret-jwt-token',
    });
  }

  /**
   * Validate JWT payload and attach user to request.
   * 
   * Called automatically by Passport after token signature verification.
   * 
   * @param payload - Decoded JWT payload
   * @returns User object attached to req.user
   * @throws {UnauthorizedException} - User not found or inactive
   */
  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.authService.validateUser(payload);
    
    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }
}
