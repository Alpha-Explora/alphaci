import type { AuthMeResponse } from "@/lib/api/contracts";

/**
 * Internal employees (company GitHub org members) are reported by the backend
 * as pro/active. Retained because callers still distinguish internal staff from
 * external users for display purposes — it no longer affects routing, since
 * this deployment has no paywall to route around.
 */
export function isInternalUser(session: AuthMeResponse | null | undefined): boolean {
  return Boolean(session?.authenticated && session.user?.isInternal);
}

export function isGuest(session: AuthMeResponse | null | undefined): boolean {
  return !session?.authenticated;
}

/**
 * Where to send a user once authentication resolves.
 *
 * This deployment is contract-billed and has no payment gateway, so there is no
 * paywall and no /subscribe route: every authenticated user goes where they were
 * headed. Guests still return null, and the caller sends them to /login.
 */
export function getAuthenticatedRedirectPath(
  session: AuthMeResponse | null | undefined,
  nextPath: string,
): string | null {
  if (!session?.authenticated) return null;
  return nextPath;
}
