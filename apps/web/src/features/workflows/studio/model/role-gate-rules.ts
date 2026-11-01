/**
 * Who may create repositories or onboard existing ones, and what to say when
 * the backend refuses.
 *
 * Developers create repositories, inside a Project; admins too (a Project
 * optional). Product owners create the Projects instead, and QA Team neither.
 * Allow-lists, so a role added later — or a session that has not loaded —
 * gets nothing until it is named. A guest is let through so the signup nudge
 * still works.
 */

import {
  REPOSITORY_CREATE_FORBIDDEN_MESSAGE,
  canCreateProjectFolder,
  canCreateRepositoryInProject,
  creationRefusalMessage,
  repositoryRequiresProject,
} from "@/features/groups";
import type { AppRole } from "@/shared/api/contracts";
import { ApiError } from "@/shared/api/request";

import { formatApiError } from "./workflow-studio-rules";

/** What the studio offers the caller, by app role (a guest is sent to sign up). */
export interface StudioCreateGates {
  /** The create wizard: Developer, admin, or a guest. */
  canCreateRepositories: boolean;
  /** Create project (an empty Project): Product owner or admin, never a guest. */
  canCreateProjects: boolean;
  /**
   * "Existing repository": onboarding names a NEW Project, which a Developer
   * may not create, so only callers free of the Project requirement get it.
   */
  existingRepoAllowed: boolean;
}

export function studioCreateGates(appRole: AppRole | null | undefined, guest: boolean): StudioCreateGates {
  return {
    canCreateRepositories: canCreateRepositories(appRole, guest),
    canCreateProjects: !guest && canCreateProjectFolder(appRole),
    existingRepoAllowed: guest || !repositoryRequiresProject(appRole),
  };
}

export function canCreateRepositories(
  appRole: AppRole | null | undefined,
  guest = false,
): boolean {
  return guest || canCreateRepositoryInProject(appRole);
}

/** Shown in place of the create / onboard controls (Product owner, QA Team). */
export const REPOSITORY_CREATE_ROLE_NOTE = REPOSITORY_CREATE_FORBIDDEN_MESSAGE;

const ROLE_GATE_MESSAGES: Readonly<Record<string, string>> = {
  project_role_forbidden: "Your role cannot create or onboard repositories.",
  repo_not_accessible:
    "ALPHACI cannot access that repository with your GitHub account. Check the name and your access, then try again.",
  main_pr_restricted:
    "Pull requests into main are restricted to the PO Studio promotion flow.",
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
  const known = creationRefusalMessage(error) ?? ROLE_GATE_MESSAGES[errorCode(error)];
  if (known) return known;
  if (error instanceof ApiError) {
    if (error.status === 401) return SIGN_IN_AGAIN;
    if (error.status === 502) return GITHUB_UNREACHABLE;
  }
  return formatApiError(error, fallback);
}
