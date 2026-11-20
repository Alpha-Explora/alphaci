import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { SessionAuthGuard } from '#kernel/auth/session-auth.guard.js';
import {
  SESSION_USER_LOOKUP,
  type SessionUserLookup,
} from '#kernel/auth/session-user-lookup.contract.js';
import type { ExecutionContext } from '@nestjs/common';
import type { SessionUser } from '#kernel/auth/session-user.interface.js';

const fakeUser: SessionUser = {
  id: 'user-1',
  login: 'testuser',
  onboardingCompleted: false,
  isInternal: false,
};

const makeContext = (session: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ session }),
    }),
  }) as unknown as ExecutionContext;

describe('SessionAuthGuard', () => {
  let guard: SessionAuthGuard;
  let findActiveSessionUser: jest.Mock;

  beforeEach(async () => {
    findActiveSessionUser = jest.fn().mockResolvedValue(fakeUser);
    const lookup = {
      findSessionUser: jest.fn(),
      findActiveSessionUser,
    } as unknown as SessionUserLookup;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionAuthGuard,
        { provide: SESSION_USER_LOOKUP, useValue: lookup },
      ],
    }).compile();

    guard = module.get(SessionAuthGuard);
  });

  it('throws when the session has neither user nor userId', async () => {
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(findActiveSessionUser).not.toHaveBeenCalled();
  });

  it('loads the user when only userId is set', async () => {
    const session: Record<string, unknown> = { userId: 'user-1' };
    await expect(guard.canActivate(makeContext(session))).resolves.toBe(true);
    expect(findActiveSessionUser).toHaveBeenCalledWith('user-1');
    expect(session['user']).toEqual(fakeUser);
  });

  it('re-reads the account even when the session caches a user', async () => {
    const stale = { ...fakeUser, login: 'old-login' };
    const session: Record<string, unknown> = { user: stale, userId: 'user-1' };
    await expect(guard.canActivate(makeContext(session))).resolves.toBe(true);
    expect(findActiveSessionUser).toHaveBeenCalledWith('user-1');
    expect(session['user']).toEqual(fakeUser);
  });

  it('signs out a session whose account was archived or deleted', async () => {
    findActiveSessionUser.mockResolvedValueOnce(null);
    const session: Record<string, unknown> = {
      user: fakeUser,
      userId: 'user-1',
    };
    await expect(guard.canActivate(makeContext(session))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(session['user']).toBeUndefined();
    expect(session['userId']).toBeUndefined();
  });
});
