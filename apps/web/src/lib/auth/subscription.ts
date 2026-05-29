import type { AuthMeResponse } from "@/lib/api/contracts";

export function hasActiveSubscription(session: AuthMeResponse | null | undefined): boolean {
  if (!session?.authenticated) {
    return false;
  }

  return session.subscription.status === "active" && session.subscription.plan !== "free";
}
