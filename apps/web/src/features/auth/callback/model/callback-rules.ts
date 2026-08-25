export type CallbackState = "checking" | "failed" | "archived_choice";
export type OAuthProvider = "github" | "google";

export interface FailedContent {
  ghost: string;
  label: string;
  accent: string;
  accentSoft: string;
  headline: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}

export function toSafeNextPath(raw: string | null): string {
  if (!raw) return "/home";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/home";
}

export function toSafeProvider(raw: string | null): OAuthProvider {
  return raw === "google" ? "google" : "github";
}

export function providerDisplayName(provider: OAuthProvider): "GitHub" | "Google" {
  return provider === "google" ? "Google" : "GitHub";
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function statusMessage(authStatus: string, provider: OAuthProvider): string {
  const providerName = providerDisplayName(provider);

  switch (authStatus) {
    case "success":
      return `${providerName} sign in complete. Finalizing your session...`;
    case "failed":
      return `${providerName} sign in failed. Please retry.`;
    case "invalid_state":
      return "The OAuth state token was invalid. Please retry sign in.";
    case "unavailable":
      return `${providerName} OAuth is unavailable in this environment.`;
    case "not_authorized":
      return "This workspace is limited to members of the company GitHub organization. Ask an administrator to add you to the org, then sign in again.";
    case "org_invite_pending":
      return "You have a pending invitation to the company GitHub organization. Accept the invitation on GitHub, then sign in again.";
    case "org_verification_failed":
      return "We could not verify your GitHub organization membership right now. Please retry sign-in in a moment. If this keeps happening, contact an administrator.";
    case "archived_choice":
      return "Checking archived account...";
    default:
      return "Finalizing sign in...";
  }
}

function safeOrgLogin(org: string | null): string | null {
  return org && /^[a-zA-Z0-9-]+$/.test(org) ? org : null;
}

export function failedContent(
  authStatus: string,
  message: string,
  orgLogin: string | null,
): FailedContent {
  switch (authStatus) {
    case "not_authorized":
      return {
        ghost: "ACCESS",
        label: "Access restricted",
        accent: "var(--accent-amber)",
        accentSoft: "rgba(251, 191, 36, 0.12)",
        headline: "This workspace is members-only",
        body: "Access is limited to members of the company GitHub organization. Ask an administrator to add you to the org, then sign in again.",
      };
    case "org_invite_pending": {
      const org = safeOrgLogin(orgLogin);
      return {
        ghost: "INVITE",
        label: "Invitation pending",
        accent: "var(--accent-amber)",
        accentSoft: "rgba(251, 191, 36, 0.12)",
        headline: "Accept your GitHub invitation",
        body: "You've been invited to the company GitHub organization, but the invitation hasn't been accepted yet. Open it on GitHub, accept it, then sign in again.",
        actionHref: org
          ? `https://github.com/orgs/${org}/invitation`
          : "https://github.com/settings/organizations",
        actionLabel: "Open GitHub invitation",
      };
    }
    case "org_verification_failed":
      return {
        ghost: "VERIFY",
        label: "Verification failed",
        accent: "var(--accent-amber)",
        accentSoft: "rgba(251, 191, 36, 0.12)",
        headline: "We couldn't verify your membership",
        body: "GitHub didn't confirm your organization membership just now. Retry in a moment — if this keeps happening, contact an administrator.",
      };
    default:
      return {
        ghost: "RETRY",
        label: "Sign-in interrupted",
        accent: "var(--brand)",
        accentSoft: "rgba(88, 166, 255, 0.12)",
        headline: "Authentication needs a retry",
        body: message,
      };
  }
}

export function accountActionErrorMessage(
  error: unknown,
  action: "restore" | "start-fresh",
): string {
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : null;
  if (action === "restore") {
    return status === null
      ? "Restore failed. Please try again."
      : `Restore failed (${status}). Please try again.`;
  }

  return status === null
    ? "Could not start fresh. Please try again."
    : `Could not start fresh (${status}). Please try again.`;
}
