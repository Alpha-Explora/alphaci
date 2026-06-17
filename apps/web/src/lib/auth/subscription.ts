import type { AuthMeResponse } from "@/lib/api/contracts";

export function hasActiveSubscription(session: AuthMeResponse | null | undefined): boolean {
  if (!session?.authenticated) return false;
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
  if (session.subscription.plan === "free") return nextPath;
  return hasActiveSubscription(session) ? nextPath : "/subscribe";
}
