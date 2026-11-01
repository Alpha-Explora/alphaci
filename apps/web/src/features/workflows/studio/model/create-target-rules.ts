/* Where a new repository goes: the team (?group=) and the team Project
 * (?project=) a link into the Create Project wizard asked for. Pure. */

import {
  PROJECT_FEATURES_REQUIRED_MESSAGE,
  PROJECT_REQUIRED_MESSAGE,
  repositoryBlockedByFeatures,
} from "@/features/groups";
import type { AppRole } from "@/shared/api/contracts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shape-only id checks; membership is decided against real data later. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,100}$/;

export interface CreateTargetParams {
  /** A plausible team id; applied only if it is one of the caller's teams. */
  groupId: string | null;
  /** A UUID; applied only once it resolves to a Project in the chosen team. */
  deliveryProjectId: string | null;
}

export interface ResolvedTargetProject {
  id: string;
  name: string;
  groupId: string;
}

/** Read `?group=` and `?project=`, softly: anything malformed is ignored. */
export function parseCreateTargetParams(params: {
  get: (key: string) => string | null;
}): CreateTargetParams {
  const group = params.get("group")?.trim() ?? "";
  const project = params.get("project")?.trim() ?? "";
  return {
    groupId: SAFE_ID.test(group) ? group : null,
    deliveryProjectId: UUID.test(project) ? project : null,
  };
}

/** The team to preselect: the linked one when the caller is in it, else their only team. */
export function preselectedWorkspaceId(
  current: string | null,
  linkedGroupId: string | null,
  workspaces: ReadonlyArray<{ id: string }>,
): string | null {
  if (current) return current;
  if (linkedGroupId && workspaces.some((workspace) => workspace.id === linkedGroupId)) {
    return linkedGroupId;
  }
  return workspaces.length === 1 ? workspaces[0].id : null;
}

/**
 * The Project to send as `deliveryProjectId`: only while the repository is
 * being created in that Project's own team. Switching team drops it rather
 * than sending a Project from another team.
 */
export function effectiveDeliveryProjectId(
  target: ResolvedTargetProject | null,
  workspaceId: string | null | undefined,
): string | undefined {
  if (!target || !workspaceId) return undefined;
  return target.groupId === workspaceId ? target.id : undefined;
}

/** "Checkout squad / testfinals", or null when no Project applies. */
export function targetProjectLabel(
  target: ResolvedTargetProject | null,
  workspaceId: string | null | undefined,
  workspaces: ReadonlyArray<{ id: string; name: string }> | null,
): string | null {
  if (!effectiveDeliveryProjectId(target, workspaceId) || !target) return null;
  const team = workspaces?.find((workspace) => workspace.id === target.groupId);
  return `${team?.name ?? "Team"} / ${target.name}`;
}

/** The name of the Project the repository joins, or null when it joins none. */
export function joinedProjectName(
  target: ResolvedTargetProject | null,
  workspaceId: string | null | undefined,
): string | null {
  if (!effectiveDeliveryProjectId(target, workspaceId) || !target) return null;
  return target.name;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** A getDeliveryProject reply, read defensively. Null when unusable. */
export function readTargetProject(value: unknown, requestedId: string): ResolvedTargetProject | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const groupId = text(raw.groupId);
  if (!groupId || raw.status === "archived") return null;
  return { id: text(raw.id) || requestedId, name: text(raw.name) || "Project", groupId };
}

/* ── A Developer's chosen Project ───────────────────────────────────────── */

/* The select's prompt and its empty state, through this model so the
 * studio's views never reach into another domain for copy. */
export {
  NO_PROJECT_YET_MESSAGE,
  PROJECT_FEATURES_REQUIRED_MESSAGE,
  PROJECT_REQUIRED_MESSAGE,
} from "@/features/groups";

export const RENDER_VARIABLES_MISSING_MESSAGE =
  "Add at least one Render environment variable before creating the repository.";

/**
 * Why Create cannot be sent yet, or null when it can: Render provisioning
 * without a variable, a Developer's repository with no Project (the
 * backend's 400 PROJECT_REQUIRED), or into a Project with no Feature yet
 * (its 409 PROJECT_FEATURES_REQUIRED), caught before the round trip.
 */
export function createRepositoryBlocker(input: {
  renderVariablesMissing: boolean;
  requiresProject: boolean;
  deliveryProjectId: string | undefined;
  /** The target Project's features blocker (see projectFeaturesBlocker), or null. */
  featuresBlocker?: string | null;
}): string | null {
  if (input.renderVariablesMissing) return RENDER_VARIABLES_MISSING_MESSAGE;
  if (input.requiresProject && !input.deliveryProjectId) return PROJECT_REQUIRED_MESSAGE;
  return input.featuresBlocker ?? null;
}

/** One entry of the wizard's Project select. */
export interface ProjectChoiceOption {
  id: string;
  name: string;
  /** Active Features, or null when the server sent no count (then the server decides). */
  featureCount: number | null;
}

/** The team's Projects as select options, in the order the server sent them. */
export function projectChoiceOptions(
  folders: ReadonlyArray<{ deliveryProjectId: string; name: string; featureCount: number | null }>,
): ProjectChoiceOption[] {
  return folders.map((folder) => ({
    id: folder.deliveryProjectId,
    name: folder.name,
    featureCount: folder.featureCount,
  }));
}

/** A select entry as shown to this caller: off, and saying why, while it has no Feature. */
export interface ProjectChoiceEntry {
  id: string;
  label: string;
  disabled: boolean;
}

export const NO_FEATURES_SUFFIX = "(no Features yet)";

export function projectChoiceEntries(
  options: ReadonlyArray<ProjectChoiceOption>,
  appRole: AppRole | null | undefined,
): ProjectChoiceEntry[] {
  return options.map((option) => {
    const disabled = repositoryBlockedByFeatures(appRole, option.featureCount);
    return { id: option.id, label: disabled ? `${option.name} ${NO_FEATURES_SUFFIX}` : option.name, disabled };
  });
}

/**
 * The sentence that stops this caller creating in the target Project (a
 * `?project=` link or the picked one), or null. Only an exact 0 Features
 * blocks; a Project the team list does not know is left to the server.
 */
export function projectFeaturesBlocker(
  targetId: string | undefined,
  options: ReadonlyArray<ProjectChoiceOption>,
  appRole: AppRole | null | undefined,
): string | null {
  if (!targetId) return null;
  const featureCount = options.find((option) => option.id === targetId)?.featureCount ?? null;
  return repositoryBlockedByFeatures(appRole, featureCount) ? PROJECT_FEATURES_REQUIRED_MESSAGE : null;
}

/** A picked option as a target in the team it was picked in; null clears the choice. */
export function chosenTargetProject(
  option: ProjectChoiceOption | null | undefined,
  workspaceId: string | null | undefined,
): ResolvedTargetProject | null {
  if (!option || !workspaceId) return null;
  return { id: option.id, name: option.name, groupId: workspaceId };
}

/**
 * The Project the repository goes into: a `?project=` link's when it belongs
 * to the team being created in, else the one picked in the wizard for that
 * same team, else none.
 */
export function applicableTargetProject(
  linked: ResolvedTargetProject | null,
  chosen: ResolvedTargetProject | null,
  workspaceId: string | null | undefined,
): ResolvedTargetProject | null {
  if (effectiveDeliveryProjectId(linked, workspaceId)) return linked;
  if (effectiveDeliveryProjectId(chosen, workspaceId)) return chosen;
  return null;
}

/**
 * The team the repository is created in. A known Project (a resolved
 * `?project=` link, else the one a Developer picked) decides it: the backend
 * needs `workspaceId` and the Project must belong to it, so it is the
 * Project's own team. Only with no Project known does the team picker's
 * selection apply.
 */
export function createWorkspaceId(
  linked: ResolvedTargetProject | null,
  chosen: ResolvedTargetProject | null,
  selectedWorkspaceId: string | null,
): string | null {
  return linked?.groupId ?? chosen?.groupId ?? selectedWorkspaceId;
}

/** What the wizard derives from the linked and picked Projects and the team pick. */
export interface CreateTargetView {
  /** The team the repository is created in: a known Project's own, else the pick. */
  workspaceId: string | null;
  /** Whether a Project is known (linked or picked), so no team is asked for. */
  projectKnown: boolean;
  /** Whether the known Project was picked in the wizard (and can be un-picked). */
  projectChosen: boolean;
  /** "Team / Project" for the known Project, or null when none applies. */
  label: string | null;
  /** The linked Project's own name (a fixed line in the wizard), else null. */
  linkedProjectName: string | null;
  /** The Project's own name while the repository joins one (linked or picked), else null. */
  joinedProjectName: string | null;
  /** The Project picked in the wizard, or null. */
  chosenProjectId: string | null;
}

export function createTargetView(input: {
  /** The resolved `?project=` link's Project, only on a wizard link. */
  linked: ResolvedTargetProject | null;
  chosen: ResolvedTargetProject | null;
  selectedWorkspaceId: string | null;
  workspaces: ReadonlyArray<{ id: string; name: string }> | null;
}): CreateTargetView {
  const { linked, chosen, workspaces } = input;
  const workspaceId = createWorkspaceId(linked, chosen, input.selectedWorkspaceId);
  const applicable = applicableTargetProject(linked, chosen, workspaceId);
  return {
    workspaceId,
    projectKnown: applicable !== null,
    projectChosen: applicable !== null && applicable === chosen,
    label: targetProjectLabel(applicable, workspaceId, workspaces),
    linkedProjectName: joinedProjectName(linked, workspaceId),
    joinedProjectName: joinedProjectName(applicable, workspaceId),
    chosenProjectId: effectiveDeliveryProjectId(chosen, workspaceId) ?? null,
  };
}

/** The create payload, owned by the team (and Project) it is created in. */
export function scopeCreatePayload<T extends object>(
  payload: T,
  workspaceId: string | undefined,
  deliveryProjectId: string | undefined,
): T & { workspaceId?: string; deliveryProjectId?: string } {
  return {
    ...payload,
    ...(workspaceId ? { workspaceId } : {}),
    ...(deliveryProjectId ? { deliveryProjectId } : {}),
  };
}
