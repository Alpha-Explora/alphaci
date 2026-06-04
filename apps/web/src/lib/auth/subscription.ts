import type { AuthMeResponse } from "@/lib/api/contracts";

export function hasActiveSubscription(session: AuthMeResponse | null | undefined): boolean {
  if (!session?.authenticated) return false;
  // Subscription gate is temporarily bypassed — any authenticated user has access.
  // Re-enable by restoring: session.subscription.status === "active" && session.subscription.plan !== "free"
  return true;
}

export function isGuest(session: AuthMeResponse | null | undefined): boolean {
  return !session?.authenticated;
}
