/* The Project name asked for when a repository is created: the name the team
 * sees on Teams -> Projects, independent of the repository names. Pure. */

import { ApiError } from "@/shared/api/request";

export const PROJECT_NAME_MAX = 80;

export const PROJECT_NAME_HELP =
  "The name your team sees on Teams → Projects. It can differ from the repository names.";

export const PROJECT_NAME_TAKEN_MESSAGE =
  "A Project with this name already exists in this team. Choose another name.";

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/;

export type ProjectNameCheck =
  | { ok: true; name: string }
  | { ok: false; message: string };

/** Trimmed, 1..80 characters, no control characters. */
export function validateProjectName(raw: string): ProjectNameCheck {
  const name = raw.trim();
  if (!name) return { ok: false, message: "Project name is required." };
  if (name.length > PROJECT_NAME_MAX) {
    return { ok: false, message: `Project name must be ${PROJECT_NAME_MAX} characters or fewer.` };
  }
  if (CONTROL_CHARACTERS.test(name)) {
    return { ok: false, message: "Project name cannot contain control characters." };
  }
  return { ok: true, name };
}

export function isProjectNameValid(raw: string): boolean {
  return validateProjectName(raw).ok;
}

/**
 * What to show under the field while typing. An empty field stays quiet (it is
 * required, and the step's Continue says so by being disabled); only text that
 * can never be accepted is called out.
 */
export function projectNameFieldMessage(raw: string, serverError: string | null): string | null {
  if (serverError) return serverError;
  if (!raw.trim()) return null;
  const check = validateProjectName(raw);
  return check.ok ? null : check.message;
}

/** Whether the Project name stands in the way of the step: null = joining a Project, nothing to name. */
export function isProjectNameStepReady(projectName: string | null, serverError: string | null): boolean {
  if (projectName === null) return true;
  return !serverError && isProjectNameValid(projectName);
}

/** The read-only line when the repository joins an existing Project. */
export function addingToProjectLine(projectName: string | null | undefined): string {
  const name = projectName?.trim();
  return name ? `Adding to Project: ${name}` : "Adding to an existing Project";
}

/** The Review step's "Project" value. */
export function reviewProjectLabel(
  joinsProject: boolean,
  joinedProjectName: string | null | undefined,
  typedName: string,
): string {
  if (joinsProject) return joinedProjectName?.trim() || "Existing Project";
  return typedName.trim() || "Project name";
}

/** The backend's 409 PROJECT_NAME_TAKEN, before any repository was created. */
export function isProjectNameTakenError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 409) return false;
  const body = error.details;
  if (typeof body !== "object" || body === null || !("code" in body)) return false;
  const { code } = body as { code: unknown };
  return typeof code === "string" && code.toUpperCase() === "PROJECT_NAME_TAKEN";
}

/**
 * The name to send as `projectName`: trimmed, and only when the repository is
 * not joining an existing Project (the backend ignores it then).
 */
export function projectNameForRequest(
  projectName: string,
  deliveryProjectId: string | undefined,
): string | null {
  if (deliveryProjectId) return null;
  return projectName.trim();
}
