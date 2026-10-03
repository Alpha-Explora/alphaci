/* Pure rules for the project explorer. No React, no Next, no fetch.
 *
 * Every wire field is read through a reader here, so a response that is
 * missing a field (an older backend, a partial row) degrades to a safe default
 * instead of crashing the Teams page. */

import type {
  DeletedRepository,
  DeleteProjectFailure,
  DeleteProjectOutcome,
  FolderProject,
  FolderRepository,
  MoveOutcome,
  ProjectFolder,
  ProjectFoldersSnapshot,
  RepoRole,
  UnfiledProject,
} from "./project-folder-types";

import {
  NO_PROJECT_YET_MESSAGE,
  PROJECT_CREATE_FORBIDDEN_MESSAGE,
  PROJECT_FEATURES_REQUIRED_MESSAGE,
  creationRefusalMessage,
  readFeatureCount,
  repositoryBlockedByFeatures,
} from "@/features/groups";
import { seesProjectAsProduct } from "@/features/projects/detail";
import type { AppRole } from "@/shared/api/contracts";

type Json = Record<string, unknown>;

/* ── Primitive readers ──────────────────────────────────────────────────── */

function asRecord(value: unknown): Json | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** An exact boolean, or null when the field is missing or anything else. */
function readFlag(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** A non-empty string, or null. */
function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

const ROLES: ReadonlyArray<RepoRole> = ["frontend", "backend", "service", "app"];

/** Unknown or missing roles read as "app": the one role that claims nothing. */
export function readRole(value: unknown): RepoRole {
  return ROLES.includes(value as RepoRole) ? (value as RepoRole) : "app";
}

/* ── Normalisers ────────────────────────────────────────────────────────── */

function readFolderProject(value: unknown): FolderProject | null {
  const raw = asRecord(value);
  const id = readOptionalString(raw?.id);
  if (!raw || !id) return null;
  return {
    id,
    role: readRole(raw.role),
    status: readString(raw.status, "unknown"),
    repoShape: readOptionalString(raw.repoShape),
  };
}

function readRepository(value: unknown): FolderRepository | null {
  const raw = asRecord(value);
  const repositoryId = readOptionalString(raw?.repositoryId);
  if (!raw || !repositoryId) return null;
  const repoFullName = readOptionalString(raw.repoFullName);
  return {
    repositoryId,
    name: readOptionalString(raw.name) ?? repoFullName ?? "Unnamed repository",
    repoFullName,
    status: readString(raw.status, "unknown"),
    project: readFolderProject(raw.project),
  };
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function readFolder(value: unknown): ProjectFolder | null {
  const raw = asRecord(value);
  const deliveryProjectId = readOptionalString(raw?.deliveryProjectId);
  if (!raw || !deliveryProjectId) return null;
  return {
    deliveryProjectId,
    systemId: readString(raw.systemId),
    name: readOptionalString(raw.name) ?? "Untitled Project",
    createdAt: readOptionalString(raw.createdAt),
    featureCount: readFeatureCount(raw.featureCount),
    // Creation order, exactly as the server sends it.
    repositories: asArray(raw.repositories).map(readRepository).filter(isPresent),
  };
}

function readUnfiled(value: unknown): UnfiledProject | null {
  const raw = asRecord(value);
  const id = readOptionalString(raw?.id);
  if (!raw || !id) return null;
  const repoFullName = readOptionalString(raw.repoFullName);
  return {
    id,
    name: readOptionalString(raw.name) ?? repoFullName ?? "Unnamed project",
    repoFullName,
    role: readRole(raw.role),
    status: readString(raw.status, "unknown"),
    repoShape: readOptionalString(raw.repoShape),
  };
}

/**
 * The explorer's view of GET /groups/:groupId/project-folders.
 *
 * Folders keep the server's order (by name, case-insensitive). `canManage` is
 * only true when the server says exactly `true` — a missing flag must never
 * hand out lead actions. `canCreateProject` and `canCreateRepository` stay
 * null when the server sends no boolean, so the caller falls back to the
 * app-role allow-list.
 */
export function normaliseProjectFolders(
  value: unknown,
  requestedGroupId: string,
): ProjectFoldersSnapshot {
  const raw = asRecord(value) ?? {};
  return {
    groupId: readOptionalString(raw.groupId) ?? requestedGroupId,
    canManage: raw.canManage === true,
    canCreateProject: readFlag(raw.canCreateProject),
    canCreateRepository: readFlag(raw.canCreateRepository),
    folders: asArray(raw.folders).map(readFolder).filter(isPresent),
    unfiled: asArray(raw.unfiled).map(readUnfiled).filter(isPresent),
  };
}

export function normaliseMoveOutcome(value: unknown): MoveOutcome {
  const raw = asRecord(value) ?? {};
  return {
    moved: raw.moved !== false,
    sourceDeliveryProjectId: readOptionalString(raw.sourceDeliveryProjectId),
    sourceDeliveryProjectEmpty: raw.sourceDeliveryProjectEmpty === true,
  };
}

function readDeletedRepository(value: unknown): DeletedRepository | null {
  const raw = asRecord(value);
  const repositoryId = readOptionalString(raw?.repositoryId);
  if (!raw || !repositoryId) return null;
  return {
    repositoryId,
    name: readOptionalString(raw.name) ?? "Unnamed repository",
    projectId: readOptionalString(raw.projectId),
    githubRepoDeleted: raw.githubRepoDeleted === true,
  };
}

/** The 200 body of DELETE /delivery-projects/:id. */
export function normaliseDeleteOutcome(value: unknown, requestedId: string): DeleteProjectOutcome {
  const raw = asRecord(value) ?? {};
  return {
    deliveryProjectId: readOptionalString(raw.deliveryProjectId) ?? requestedId,
    name: readOptionalString(raw.name) ?? "",
    deletedRepositories: asArray(raw.deletedRepositories).map(readDeletedRepository).filter(isPresent),
  };
}

/* ── Labels ─────────────────────────────────────────────────────────────── */

const ROLE_LABELS: Record<RepoRole, string> = {
  frontend: "Frontend",
  backend: "Backend",
  service: "Service",
  app: "App",
};

export function repoRoleLabel(role: RepoRole): string {
  return ROLE_LABELS[role];
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function repositoryCountLabel(count: number): string {
  return plural(count, "repository", "repositories");
}

/** The short repository name: "Org/testfinals-fe" -> "testfinals-fe". */
export function repoDisplayName(repo: { name: string; repoFullName: string | null }): string {
  if (!repo.repoFullName) return repo.name;
  return repo.repoFullName.split("/").at(-1) || repo.repoFullName;
}

/* ── Folder rules ───────────────────────────────────────────────────────── */

/** The AlphaCI project ids of a Project's linked repositories, in order. */
export function folderProjectIds(folder: ProjectFolder): string[] {
  const ids: string[] = [];
  for (const repo of folder.repositories) {
    if (repo.project && !ids.includes(repo.project.id)) ids.push(repo.project.id);
  }
  return ids;
}

/**
 * The project QA Studio opens for "Verify in QA Studio": the frontend
 * repository's, else an app's. A backend or service has nothing to preview.
 */
export function verifyProjectId(folder: ProjectFolder): string | null {
  const linked = folder.repositories.map((repo) => repo.project).filter(isPresent);
  const frontend = linked.find((project) => project.role === "frontend");
  const app = linked.find((project) => project.role === "app");
  return (frontend ?? app)?.id ?? null;
}

/**
 * The page a Project card opens: its frontend repository's project, else the
 * first linked repository's. Null when nothing in the Project has a page yet,
 * and the card then opens the Project's detail instead.
 */
export function folderLandingProjectId(folder: ProjectFolder): string | null {
  const linked = folder.repositories.map((repo) => repo.project).filter(isPresent);
  return (linked.find((project) => project.role === "frontend") ?? linked[0])?.id ?? null;
}

/** Every Project of the team except the one the repository is in. */
export function moveTargets(
  folders: ReadonlyArray<ProjectFolder>,
  currentFolderId: string,
): ProjectFolder[] {
  return folders.filter((folder) => folder.deliveryProjectId !== currentFolderId);
}

export function findFolder(
  folders: ReadonlyArray<ProjectFolder>,
  deliveryProjectId: string | null,
): ProjectFolder | null {
  if (!deliveryProjectId) return null;
  return folders.find((folder) => folder.deliveryProjectId === deliveryProjectId) ?? null;
}

/* ── Features before repositories ───────────────────────────────────────── */

export const FEATURES_REQUIRED_NOTE = PROJECT_FEATURES_REQUIRED_MESSAGE;
export const FEATURE_NUDGE_MESSAGE = "Add a Feature so Developers can add repositories.";

/** How a Project offers "Add repository": a link, a disabled control with the note, or nothing. */
export type AddRepositoryState = "enabled" | "blocked" | "hidden";

export interface FolderFeatureGate {
  addRepository: AddRepositoryState;
  /** A Product owner (or admin) is asked to add the first Feature. */
  featureNudge: boolean;
}

/**
 * What a Project offers by its Feature count. A Developer may add a
 * repository only once the Project has a Feature (admins are exempt); while
 * it has none, the control stays on screen, disabled, with the reason. A
 * Product owner or admin who can write requirements is nudged to add the
 * first one. An unknown count changes nothing: the server decides.
 */
export function folderFeatureGate(
  folder: Pick<ProjectFolder, "featureCount">,
  caller: {
    appRole: AppRole | null | undefined;
    canCreateRepository: boolean;
    canManageRequirements: boolean;
  },
): FolderFeatureGate {
  const blocked = repositoryBlockedByFeatures(caller.appRole, folder.featureCount);
  let addRepository: AddRepositoryState = "hidden";
  if (caller.canCreateRepository) addRepository = blocked ? "blocked" : "enabled";
  return {
    addRepository,
    featureNudge: folder.featureCount === 0 && caller.canManageRequirements,
  };
}

/** The folders with locally known Feature counts (a Feature just written) laid over the server's. */
export function withFeatureCounts(
  folders: ReadonlyArray<ProjectFolder>,
  counts: Readonly<Record<string, number>>,
): ProjectFolder[] {
  return folders.map((folder) => {
    const known = counts[folder.deliveryProjectId];
    return known === undefined || known === folder.featureCount ? folder : { ...folder, featureCount: known };
  });
}

/* ── Links ──────────────────────────────────────────────────────────────── */

export function projectDashboardHref(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`;
}

/**
 * Whether a repository chip opens that repository's page for this viewer.
 * The QA Team and Product owners open a Project, which lands on its frontend
 * (`folderLandingProjectId`), and their page has no switch to a sibling; a
 * backend chip would strand them on a repository that is not theirs, so for
 * them only a frontend chip is a link. Everyone else opens any repository.
 */
export function repoChipOpens(appRole: AppRole | null | undefined, role: RepoRole | null): boolean {
  return !seesProjectAsProduct(appRole) || role === "frontend";
}

/** The create-project wizard, pre-scoped to this team and Project. */
export function createRepositoryHref(groupId: string, deliveryProjectId?: string): string {
  const params = new URLSearchParams({ tab: "setup", group: groupId });
  if (deliveryProjectId) params.set("project", deliveryProjectId);
  return `/workflows?${params.toString()}`;
}

/* ── Role copy ──────────────────────────────────────────────────────────── */

export const EMPTY_PROJECTS_CREATOR_LINE = "Create the first Project for this team.";
export const EMPTY_PROJECTS_DEVELOPER_LINE = NO_PROJECT_YET_MESSAGE;

/**
 * The role line under "No Projects yet": a Product owner (or admin) is asked
 * to create one, a Developer is told who does, and anyone else (QA Team) gets
 * no line at all.
 */
export function emptyProjectsCopy(caller: {
  canCreateProject: boolean;
  canCreateRepository: boolean;
}): string | null {
  if (caller.canCreateProject) return EMPTY_PROJECTS_CREATOR_LINE;
  if (caller.canCreateRepository) return EMPTY_PROJECTS_DEVELOPER_LINE;
  return null;
}

/** Under an empty Project's repository list, by what the caller may do. */
export function emptyRepositoriesCopy(canCreateRepository: boolean): string {
  return canCreateRepository
    ? "No repositories in this Project yet. Add the first one and it lands here."
    : "No repositories in this Project yet. Developers add them.";
}

/* ── Validation ─────────────────────────────────────────────────────────── */

export const PROJECT_NAME_MAX = 200;

/** Why a Project name cannot be saved, or null when it can. */
export function projectNameError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Give the Project a name.";
  if (trimmed.length > PROJECT_NAME_MAX) {
    return `Keep the name under ${PROJECT_NAME_MAX} characters.`;
  }
  return null;
}

/* ── Errors (display strings, never API objects) ────────────────────────── */

function errorStatus(cause: unknown): number | null {
  const raw = asRecord(cause);
  return typeof raw?.status === "number" ? raw.status : null;
}

/** The parsed JSON error body ApiError carries in `details`, or `{}`. */
function errorDetails(cause: unknown): Json {
  const raw = asRecord(cause);
  return asRecord(raw?.details) ?? {};
}

function errorCode(cause: unknown): string | null {
  return readOptionalString(errorDetails(cause).code);
}

const LOAD_MESSAGES: Record<number, string> = {
  401: "Your session expired. Please sign in again.",
  403: "You do not have access to this team's Projects.",
  // A non-member gets 404, as does a team that no longer exists.
  404: "This team's Projects are not available.",
};

export function loadErrorMessage(cause: unknown): string {
  return LOAD_MESSAGES[errorStatus(cause) ?? 0] ?? "Projects could not be loaded. Try again in a moment.";
}

export const MOVE_CONFLICT_MESSAGE =
  "This repository was moved by someone else. Refresh and try again.";

const MOVE_MESSAGES: Record<number, string> = {
  400: "Archived repositories and Projects cannot be moved.",
  403: "Only a Team lead can move repositories.",
  404: "That Project no longer exists in this team. Refresh and try again.",
  409: MOVE_CONFLICT_MESSAGE,
};

export function moveErrorMessage(cause: unknown): string {
  return MOVE_MESSAGES[errorStatus(cause) ?? 0] ?? "The repository could not be moved. Try again in a moment.";
}

export function isConflict(cause: unknown): boolean {
  return errorStatus(cause) === 409;
}

const CREATE_MESSAGES: Record<number, string> = {
  400: "That name cannot be used. Check it and try again.",
  403: PROJECT_CREATE_FORBIDDEN_MESSAGE,
  409: "A Project with that name already exists in this team.",
};

export function createErrorMessage(cause: unknown): string {
  return (
    creationRefusalMessage(cause) ??
    CREATE_MESSAGES[errorStatus(cause) ?? 0] ??
    "The Project could not be created. Try again in a moment."
  );
}

/* ── Delete Project ─────────────────────────────────────────────────────── */

export const DELETE_NAME_MISMATCH_MESSAGE = "That name doesn't match. Type it exactly to confirm.";

const DELETE_MESSAGES: Record<number, string> = {
  403: "Only a Team lead or admin can delete this Project.",
  404: "This Project no longer exists. Refresh and try again.",
  429: "Too many requests. Try again in a moment.",
};

/** Display-string mapping for every non-409 delete failure. */
export function deleteErrorMessage(cause: unknown): string {
  const status = errorStatus(cause);
  if (status === 400 && errorCode(cause) === "DELIVERY_PROJECT_NAME_MISMATCH") {
    return DELETE_NAME_MISMATCH_MESSAGE;
  }
  return DELETE_MESSAGES[status ?? 0] ?? "The Project could not be deleted. Try again in a moment.";
}

export function isDeleteConflict(cause: unknown): boolean {
  return errorStatus(cause) === 409;
}

function readFailedRepository(value: unknown): { repositoryId: string; name: string } | null {
  const raw = asRecord(value);
  const repositoryId = readOptionalString(raw?.repositoryId);
  if (!raw || !repositoryId) return null;
  return { repositoryId, name: readOptionalString(raw.name) ?? "that repository" };
}

const DELETE_PARTIAL_FALLBACK = "Some repositories could not be deleted. Try again in a moment.";

/**
 * The 409 body: one repository failed (a provider call, most likely), so the
 * Project is kept with whatever it managed to delete before that.
 */
export function deletePartialFailure(cause: unknown): DeleteProjectFailure {
  const details = errorDetails(cause);
  return {
    code: readOptionalString(details.code) ?? "",
    message: readOptionalString(details.message) ?? DELETE_PARTIAL_FALLBACK,
    deletedRepositories: asArray(details.deletedRepositories).map(readDeletedRepository).filter(isPresent),
    failedRepository: readFailedRepository(details.failedRepository),
  };
}

/** Submit is disabled until this matches the Project's name exactly. */
export function deleteConfirmMatches(input: string, name: string): boolean {
  return input === name;
}

/** The explorer's status notice once the delete lands. */
export function deleteNoticeText(outcome: DeleteProjectOutcome): string {
  return `Deleted ${outcome.name} and ${repositoryCountLabel(outcome.deletedRepositories.length)}.`;
}
