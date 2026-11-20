import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import {
  SESSION_USER_LOOKUP,
  type SessionUserLookup,
} from '#kernel/auth/session-user-lookup.contract';

/**
 * A session acts as its account only while that account exists and is not
 * archived. The account is read on every request rather than trusted from the
 * session, so deleting an account ends every one of its sessions, not just the
 * one that deleted it, and the session's copy of the user stays current.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    @Inject(SESSION_USER_LOOKUP)
    private readonly sessionUserLookup: SessionUserLookup,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const session = request.session;
    const userId = session?.userId ?? session?.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.sessionUserLookup.findActiveSessionUser(userId);
    if (!user) {
      delete session.user;
      delete session.userId;
      throw new UnauthorizedException('Authentication required');
    }

    session.user = user;
    session.userId = user.id;
    return true;
  }
}
