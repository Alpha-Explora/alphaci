import type { SessionUser } from '#kernel/auth/session-user.interface';

/**
 * Minimal identity lookup needed by HTTP session authentication.
 *
 * The guard depends on this contract rather than on the auth repository. The
 * adapter that owns the users table can change without making the kernel know
 * about a feature module or its persistence implementation.
 */
export interface SessionUserLookup {
  /** Any account, archived included (GitHub access sync revokes for archived users). */
  findSessionUser(userId: string): Promise<SessionUser | null>;
  /** The account only while it is not archived: what a session may act as. */
  findActiveSessionUser(userId: string): Promise<SessionUser | null>;
}

export const SESSION_USER_LOOKUP = Symbol('SESSION_USER_LOOKUP');
