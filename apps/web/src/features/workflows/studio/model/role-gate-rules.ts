/**
 * Who may create repositories or onboard existing ones, and what to say when
 * the backend refuses.
 *
 * Mirrors the backend allow-lists (admin/lead only for `POST /github/repos`,
 * `POST /existing-repos/discover` and `/setup-pr`). Allow-lists, so a role
 * added later — or a session that has not loaded — gets nothing until it is
 * named. A guest is let through so the signup nudge still works.
 */

import { isGlobalCreatorRole } from "@/features/groups";
import type { AppRole } from "@/shared/api/contracts";
import { ApiError } from "@/shared/api/request";

import { formatApiError } from "./workflow-studio-rules";

export function canCreateRepositories(
  appRole: AppRole | null | undefined,
  guest = false,
): boolean {
  return guest || isGlobalCreatorRole(appRole);
}

/** Shown in place of the create / onboard controls. */
export const REPOSITORY_CREATE_LEAD_ONLY_NOTE =
  "A Team lead or admin can create repositories and onboard existing ones.";

const ROLE_GATE_MESSAGES: Readonly<Record<string, string>> = {
  project_role_forbidden:
    "Only team leads and admins can create or onboard repositories.",
  repo_not_accessible:
    "ALPHACI cannot access that repository with your GitHub account. Check the name and your access, then try again.",
  main_pr_restricted:
    "Pull requests into main are restricted to the QA Studio promotion flow.",
  pr_base_branch_missing:
    "This repository has no dev or uat branch to open the setup pull request against. Create one, then try again.",
  installation_not_accessible:
    "You do not have access to that GitHub installation.",
};

const SIGN_IN_AGAIN = "Your GitHub session expired. Sign in again, then retry.";
const GITHUB_UNREACHABLE =
  "GitHub could not be reached just now. Try again in a moment.";

function errorCode(error: unknown): string {
  if (!(error instanceof ApiError)) return "";
  const body = error.details;
  if (typeof body !== "object" || body === null || !("code" in body)) return "";
  const { code } = body as { code: unknown };
  return typeof code === "string" ? code.toLowerCase() : "";
}

/**
 * Display text for the role-gate refusals on repository create / onboarding
 * and GitHub installation linking, by the backend's code (or status for 401 /
 * 502). Anything else falls through to {@link formatApiError}, so an
 * unrecognised failure still shows the server's own reason.
 */
export function roleGateErrorMessage(error: unknown, fallback: string): string {
  const known = ROLE_GATE_MESSAGES[errorCode(error)];
  if (known) return known;
  if (error instanceof ApiError) {
    if (error.status === 401) return SIGN_IN_AGAIN;
    if (error.status === 502) return GITHUB_UNREACHABLE;
  }
  return formatApiError(error, fallback);
}
