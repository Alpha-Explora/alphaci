/* Role gates and refusal text for repository configuration and assignments.
 *
 * Pure: no React, no fetch. The allow-lists mirror the backend, so a role added
 * later gets nothing until it is named here. */
import type { AppRole } from "@/shared/api/contracts";
import { ApiError } from "@/shared/api/request";

/**
 * Writing or deleting repository variables and secrets is for Developers and
 * Admins (refusal code `ENV_VARS_LEAD_ONLY`, a legacy name: Product owners
 * and QA Team are refused). The list stays visible to anyone who can open the
 * repository.
 */
const CONFIGURATION_WRITE_ROLES: ReadonlySet<AppRole> = new Set<AppRole>(["member", "admin"]);

export function canWriteRepositoryConfiguration(
  appRole: AppRole | null | undefined,
): boolean {
  return appRole != null && CONFIGURATION_WRITE_ROLES.has(appRole);
}

export const CONFIGURATION_LEAD_ONLY_NOTE =
  "Developers and admins can add or delete variables and secrets.";

const MESSAGES: Readonly<Record<string, string>> = {
  env_vars_lead_only:
    "Developers and admins can change repository variables and secrets.",
  assignment_role_not_allowed:
    "Only Developers are assigned repositories; QA and leads already see every repository in the team.",
};

function errorCode(cause: unknown): string {
  if (!(cause instanceof ApiError)) return "";
  const body = cause.details;
  if (typeof body !== "object" || body === null || !("code" in body)) return "";
  const { code } = body as { code: unknown };
  return typeof code === "string" ? code.toLowerCase() : "";
}

/** The sentence for a known refusal code, or null so the caller keeps its own. */
export function roleGateMessage(cause: unknown): string | null {
  return MESSAGES[errorCode(cause)] ?? null;
}
