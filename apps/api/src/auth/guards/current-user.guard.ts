import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { AccessTokenService } from '../access-token.service';

const userIdHeader = 'x-user-id';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CurrentUserGuard implements CanActivate {
  constructor(
    private readonly accessTokens: AccessTokenService,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.header('authorization');
    const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null;

    if (bearerToken) {
      try {
        const claims = await this.accessTokens.verify(bearerToken);
        await this.authService.assertSessionCanAccess(claims.sub, claims.sid);
        request.currentUserId = claims.sub;
        request.currentSessionId = claims.sid;
        return true;
      } catch {
        throw new UnauthorizedException('Authentication is required.');
      }
    }

    const headerValue = request.header(userIdHeader);

    if (process.env.NODE_ENV !== 'production' && headerValue && uuidPattern.test(headerValue)) {
      request.currentUserId = headerValue;
      return true;
    }

    throw new UnauthorizedException('Authentication is required.');
  }
}
