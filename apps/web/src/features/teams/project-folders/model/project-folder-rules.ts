/* Pure rules for the project explorer. No React, no Next, no fetch.
 *
 * Every wire field is read through a reader here, so a response that is
 * missing a field (an older backend, a partial row) degrades to a safe default
 * instead of crashing the Teams page. */

import type {
  ChecklistAttachment,
  FolderChecklist,
  FolderProject,
  FolderRepository,
  MoveOutcome,
  ProjectFolder,
  ProjectFoldersSnapshot,
  RepoRole,
  UnfiledProject,
} from "./project-folder-types";

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
 * hand out lead actions.
 */
export function normaliseProjectFolders(
  value: unknown,
  requestedGroupId: string,
): ProjectFoldersSnapshot {
  const raw = asRecord(value) ?? {};
  return {
    groupId: readOptionalString(raw.groupId) ?? requestedGroupId,
    canManage: raw.canManage === true,
    folders: asArray(raw.folders).map(readFolder).filter(isPresent),
    unfiled: asArray(raw.unfiled).map(readUnfiled).filter(isPresent),
  };
}

/** A team checklist, reduced to what the explorer shows. */
export function normaliseChecklist(value: unknown): FolderChecklist | null {
  const raw = asRecord(value);
  const id = readOptionalString(raw?.id);
  if (!raw || !id) return null;
  return {
    id,
    name: readOptionalString(raw.name) ?? "Untitled checklist",
    itemCount: asArray(raw.items).length,
    archived: readOptionalString(raw.archivedAt) !== null,
    sharedProjectIds: asArray(raw.sharedProjectIds).filter(
      (entry): entry is string => typeof entry === "string",
    ),
  };
}

export function normaliseChecklists(value: unknown): FolderChecklist[] {
  return asArray(value).map(normaliseChecklist).filter(isPresent);
}

export function normaliseMoveOutcome(value: unknown): MoveOutcome {
  const raw = asRecord(value) ?? {};
  return {
    moved: raw.moved !== false,
    sourceDeliveryProjectId: readOptionalString(raw.sourceDeliveryProjectId),
    sourceDeliveryProjectEmpty: raw.sourceDeliveryProjectEmpty === true,
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

export function checklistCountLabel(count: number): string {
  return plural(count, "checklist");
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
 * A Project's checklists: the live (non-archived) ones shared to at least one
 * of its repositories' projects.
 */
export function folderChecklists(
  folder: ProjectFolder,
  checklists: ReadonlyArray<FolderChecklist>,
): FolderChecklist[] {
  const ids = new Set(folderProjectIds(folder));
  if (ids.size === 0) return [];
  return checklists.filter(
    (checklist) => !checklist.archived && checklist.sharedProjectIds.some((id) => ids.has(id)),
  );
}

/** Whether a checklist covers every, some, or none of a Project's repositories. */
export function checklistAttachment(
  folder: ProjectFolder,
  checklist: FolderChecklist,
): ChecklistAttachment {
  const ids = folderProjectIds(folder);
  const shared = ids.filter((id) => checklist.sharedProjectIds.includes(id)).length;
  if (ids.length > 0 && shared === ids.length) return "attached";
  return shared > 0 ? "partial" : "none";
}

/** Live team checklists not yet covering every repository of this Project. */
export function attachableChecklists(
  folder: ProjectFolder,
  checklists: ReadonlyArray<FolderChecklist>,
): FolderChecklist[] {
  return checklists.filter(
    (checklist) => !checklist.archived && checklistAttachment(folder, checklist) !== "attached",
  );
}

/** "Attach to this Project": add every repository project of the folder. */
export function attachPatch(folder: ProjectFolder): { add: string[] } {
  return { add: folderProjectIds(folder) };
}

/** "Detach": remove every repository project of the folder, and nothing else. */
export function detachPatch(folder: ProjectFolder): { remove: string[] } {
  return { remove: folderProjectIds(folder) };
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

/* ── Links ──────────────────────────────────────────────────────────────── */

export function projectDashboardHref(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`;
}

/** The create-project wizard, pre-scoped to this team and Project. */
export function createRepositoryHref(groupId: string, deliveryProjectId?: string): string {
  const params = new URLSearchParams({ tab: "setup", group: groupId });
  if (deliveryProjectId) params.set("project", deliveryProjectId);
  return `/workflows?${params.toString()}`;
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
  403: "Only a Team lead can create Projects.",
  409: "A Project with that name already exists in this team.",
};

export function createErrorMessage(cause: unknown): string {
  return CREATE_MESSAGES[errorStatus(cause) ?? 0] ?? "The Project could not be created. Try again in a moment.";
}

const CHECKLIST_MESSAGES: Record<number, string> = {
  403: "Only a Team lead can change which checklists a Project uses.",
  404: "That checklist no longer exists. Refresh and try again.",
  409: "That checklist is archived and can no longer be attached.",
};

export function checklistPatchErrorMessage(cause: unknown): string {
  return CHECKLIST_MESSAGES[errorStatus(cause) ?? 0] ?? "The checklist could not be updated. Try again in a moment.";
}
