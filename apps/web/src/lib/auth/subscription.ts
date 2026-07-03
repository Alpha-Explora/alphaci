import type { AuthMeResponse } from "@/lib/api/contracts";

/**
 * Internal employees (company GitHub org members) are fully entitled and never
 * see the subscription/payment surface. The backend already reports them as
 * pro/active, but we short-circuit here as well so entitlement is explicit and
 * cannot regress if the backend synthetic state ever changes.
 */
export function isInternalUser(session: AuthMeResponse | null | undefined): boolean {
  return Boolean(session?.authenticated && session.user?.isInternal);
}

export function hasActiveSubscription(session: AuthMeResponse | null | undefined): boolean {
  if (!session?.authenticated) return false;
  if (isInternalUser(session)) return true;
  return session.subscription.status === "active" && session.subscription.plan !== "free";
}

export function isGuest(session: AuthMeResponse | null | undefined): boolean {
  return !session?.authenticated;
}

export function getAuthenticatedRedirectPath(
  session: AuthMeResponse | null | undefined,
  nextPath: string,
): string | null {
  if (!session?.authenticated) return null;
  // Internal users are never routed to the paywall.
  if (isInternalUser(session)) return nextPath;
  if (session.subscription.plan === "free") return nextPath;
  return hasActiveSubscription(session) ? nextPath : "/subscribe";
}
