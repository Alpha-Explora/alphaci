export type SubscriptionPlan = "free" | "pro";
export type SubscriptionStatus = "inactive" | "active" | "canceled";
export type SubscriptionProvider = "mock" | "supabase" | "manual" | "paymongo";
export type PlatformRole = "admin" | "super_admin";
export type AppRole = "admin" | "lead" | "qa" | "member";
export type AppRoleSource = "github_team" | "manual";

export interface AuthSessionUser {
  id: string;
  login: string;
  name?: string;
  avatarUrl?: string;
  email?: string;
  onboardingCompleted: boolean;
  isInternal?: boolean;
}

export interface AuthSubscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  provider: SubscriptionProvider;
  updatedAt: string;
  planCode?: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  amountPhp?: number;
  interval?: "month" | "year";
}

/** Stable session facts exposed to feature ViewModels and Views. */
export interface AuthSession {
  authenticated: boolean;
  user: AuthSessionUser;
  subscription: AuthSubscription;
  platformRole?: PlatformRole | null;
  appRole?: AppRole;
  appRoleSource?: AppRoleSource;
}
