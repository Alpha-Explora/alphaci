/**
 * Display text for the Phase 1 security-gate 403s, by the backend's own code
 * (PERSONA_WORKFLOW_SPEC.md §5, §8.1):
 *
 *   - `MAIN_MERGE_VIA_QA_STUDIO` — the generic workspace merge refused a PR
 *     into `main`; production release happens in PO Studio instead.
 *   - `PR_ROLE_FORBIDDEN`        — QA tried to open or merge a pull request.
 *   - `MAIN_PR_RESTRICTED`       — a pull request into `main` was proposed
 *     outside the promotion engine.
 *   - `PR_ROUTE_RESTRICTED`     — a Developer proposed or merged a route other
 *     than feature -> dev or dev -> uat.
 *   - `ENV_VARS_LEAD_ONLY`       — someone other than a Developer or Admin
 *     tried to list/create/update/delete an environment variable (a legacy
 *     code name: Product owners are refused now).
 *   - `PROJECT_ROLE_FORBIDDEN`  — someone other than a Team Lead or Admin
 *     tried to reinstall deployment secrets, or disconnect/delete a project.
 *   - `HOSTING_LEAD_ONLY`       — someone other than a Developer or Admin
 *     tried to change deployment targets or custom domains (legacy name).
 *   - `PR_BASE_BRANCH_MISSING`  — the workflow-settings PR needs a dev (else
 *     uat) branch and the repository has neither.
 *
 * A code is matched case-insensitively against `details.code`, the same
 * field `qa-run-rules.ts`'s `serverCode` reads for the checklists feature.
 * Unrecognised codes, and errors that carry no code at all, fall through to
 * `apiErrorReason` — the server's own message, then the caller's fallback —
 * so a backend that has not shipped a code yet still shows something useful.
 */

import { ApiError } from "@/shared/api/request";
import { apiErrorReason } from "./api-error-reason";

const WORKSPACE_PERMISSION_MESSAGES: Readonly<Record<string, string>> = {
  main_merge_via_qa_studio:
    "Merges into main go through PO Studio — Ready for production.",
  pr_role_forbidden: "QA does not open or merge pull requests.",
  main_pr_restricted:
    "Pull requests into main are restricted to the PO Studio promotion flow.",
  pr_route_restricted:
    "Developers open pull requests from a feature branch into dev, and from dev into uat.",
  env_vars_lead_only: "Developers and admins can change environment variables.",
  project_role_forbidden: "Only Product owners and admins can make this change.",
  hosting_lead_only:
    "Developers and admins can change hosting services and custom domains.",
  pr_base_branch_missing:
    "This repository has no dev or uat branch to open the pull request against. Create one, then try again.",
};

function errorCode(cause: unknown): string {
  if (!(cause instanceof ApiError)) return "";
  const body = cause.details;
  if (typeof body !== "object" || body === null || !("code" in body)) return "";
  const { code } = body as { code: unknown };
  return typeof code === "string" ? code.toLowerCase() : "";
}

/**
 * A display string for a workspace permission 403 the backend sent a known
 * code for, or `apiErrorReason`'s answer for everything else.
 */
export function workspacePermissionErrorMessage(
  cause: unknown,
  fallback: string,
): string {
  const known = WORKSPACE_PERMISSION_MESSAGES[errorCode(cause)];
  return known ?? apiErrorReason(cause, fallback);
}
