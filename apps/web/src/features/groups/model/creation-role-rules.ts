/* Who creates what, by GLOBAL app role. Pure: no React, no fetch.
 *
 * Product owners (app role `lead`) create Projects; Developers (`member`)
 * create repositories, and only inside an existing Project; admins do both,
 * and may still create a repository without a Project. QA Team creates
 * neither. Mirrors the backend gates (PROJECT_CREATE_FORBIDDEN,
 * REPOSITORY_CREATE_FORBIDDEN, PROJECT_REQUIRED).
 *
 * Allow-lists: a role added later, or a session that has not loaded, gets
 * nothing until it is named here. */
import type { AppRole } from "@/shared/api/contracts";

type Role = AppRole | null | undefined;

const PROJECT_CREATORS: ReadonlyArray<AppRole> = ["lead", "admin"];
const REPOSITORY_CREATORS: ReadonlyArray<AppRole> = ["member", "admin"];
/** May create a repository that belongs to no Project (today's admin path). */
const UNFILED_REPOSITORY_CREATORS: ReadonlyArray<AppRole> = ["admin"];

function named(list: ReadonlyArray<AppRole>, appRole: Role): boolean {
  return appRole !== null && appRole !== undefined && list.includes(appRole);
}

/** Create a Project (name + description, no repository): Product owner or admin. */
export function canCreateProjectFolder(appRole: Role): boolean {
  return named(PROJECT_CREATORS, appRole);
}

/** Create a repository (new or existing) inside a Project: Developer or admin. */
export function canCreateRepositoryInProject(appRole: Role): boolean {
  return named(REPOSITORY_CREATORS, appRole);
}

/** Create a repository with no Project chosen: admin only. */
export function canCreateRepositoryWithoutProject(appRole: Role): boolean {
  return named(UNFILED_REPOSITORY_CREATORS, appRole);
}

/** A Developer's repository must name the Project it belongs to. */
export function repositoryRequiresProject(appRole: Role): boolean {
  return canCreateRepositoryInProject(appRole) && !canCreateRepositoryWithoutProject(appRole);
}

/*
 * GET /groups/:id/project-folders sends `canCreateProject` and
 * `canCreateRepository` beside `canManage`. The server's exact boolean wins;
 * a missing or malformed flag (an older backend) falls back to the app-role
 * allow-list, never to "yes".
 */

/** The server's `canCreateProject` when it sends one, else the app-role rule. */
export function resolveCanCreateProject(serverFlag: unknown, appRole: Role): boolean {
  if (typeof serverFlag === "boolean") return serverFlag;
  return canCreateProjectFolder(appRole);
}

/** The server's `canCreateRepository` when it sends one, else the app-role rule. */
export function resolveCanCreateRepository(serverFlag: unknown, appRole: Role): boolean {
  if (typeof serverFlag === "boolean") return serverFlag;
  return canCreateRepositoryInProject(appRole);
}

/* ── Features before repositories ───────────────────────────────────────── */

/**
 * May add a repository to a Project that has no Feature yet: admin only. A
 * Developer waits for the Product owner to write the first Feature (the
 * backend's 409 PROJECT_FEATURES_REQUIRED). Product owners and QA Team cannot
 * create repositories at all, so they never reach this gate.
 */
const FEATURELESS_REPOSITORY_CREATORS: ReadonlyArray<AppRole> = ["admin"];

/** A count of active Features from the wire, or null when it is missing or malformed. */
export function readFeatureCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * True when this caller may not add a repository to a Project with this many
 * Features. Only an exact 0 blocks: an unknown count (an older backend) is
 * left to the server, which enforces the rule itself.
 */
export function repositoryBlockedByFeatures(appRole: Role, featureCount: number | null): boolean {
  return featureCount === 0 && !named(FEATURELESS_REPOSITORY_CREATORS, appRole);
}

/* ── Refusals (display strings) ─────────────────────────────────────────── */

export const PROJECT_CREATE_FORBIDDEN_MESSAGE = "Product owners create Projects.";
export const REPOSITORY_CREATE_FORBIDDEN_MESSAGE =
  "Developers create repositories inside a Project.";
export const PROJECT_REQUIRED_MESSAGE = "Choose the Project this repository belongs to.";
/** A Developer's team has no Project to put a repository in yet. */
export const NO_PROJECT_YET_MESSAGE = "Your Product owner hasn't created a Project yet.";
/** A Developer's Project has no Feature yet (409 PROJECT_FEATURES_REQUIRED). */
export const PROJECT_FEATURES_REQUIRED_MESSAGE =
  "Waiting for your Product owner to add the first Feature.";

const CREATION_MESSAGES: Readonly<Record<string, string>> = {
  PROJECT_CREATE_FORBIDDEN: PROJECT_CREATE_FORBIDDEN_MESSAGE,
  REPOSITORY_CREATE_FORBIDDEN: REPOSITORY_CREATE_FORBIDDEN_MESSAGE,
  PROJECT_REQUIRED: PROJECT_REQUIRED_MESSAGE,
  PROJECT_FEATURES_REQUIRED: PROJECT_FEATURES_REQUIRED_MESSAGE,
};

/** The `code` of an ApiError-shaped failure (its parsed body in `details`). */
function errorCode(cause: unknown): string {
  if (typeof cause !== "object" || cause === null) return "";
  const details = (cause as { details?: unknown }).details;
  if (typeof details !== "object" || details === null) return "";
  const code = (details as { code?: unknown }).code;
  return typeof code === "string" ? code.toUpperCase() : "";
}

/** The sentence for one of the creation refusals, or null for anything else. */
export function creationRefusalMessage(cause: unknown): string | null {
  return CREATION_MESSAGES[errorCode(cause)] ?? null;
}
