/**
 * Display text for the Phase 1 security-gate 403s, by the backend's own code
 * (PERSONA_WORKFLOW_SPEC.md §5, §8.1):
 *
 *   - `MAIN_MERGE_VIA_QA_STUDIO` — the generic workspace merge refused a PR
 *     into `main`; production release happens in QA Studio instead.
 *   - `PR_ROLE_FORBIDDEN`        — QA tried to open or merge a pull request.
 *   - `MAIN_PR_RESTRICTED`       — a pull request into `main` was proposed
 *     outside the promotion engine.
 *   - `ENV_VARS_LEAD_ONLY`       — someone other than a Team Lead or Admin
 *     tried to list/create/update/delete an environment variable.
 *   - `PROJECT_ROLE_FORBIDDEN`  — someone other than a Team Lead or Admin
 *     tried to reinstall deployment secrets, or disconnect/delete a project.
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
    "Merges into main go through QA Studio — Ready for production.",
  pr_role_forbidden: "QA does not open or merge pull requests.",
  main_pr_restricted:
    "Pull requests into main are restricted to the QA Studio promotion flow.",
  env_vars_lead_only: "Only team leads and admins can manage environment variables.",
  project_role_forbidden: "Only team leads and admins can make this change.",
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
