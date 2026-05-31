import type { AuthMeResponse } from "@/lib/api/contracts";

export function hasActiveSubscription(session: AuthMeResponse | null | undefined): boolean {
  if (!session?.authenticated) {
    return false;
  }

  return session.subscription.status === "active" && session.subscription.plan !== "free";
}

export function isGuest(session: AuthMeResponse | null | undefined): boolean {
  // Guest = not authenticated OR authenticated but no active paid plan
  if (!session?.authenticated) return true;
  return session.subscription.status !== "active" || session.subscription.plan === "free";
}
