/* Where a new repository goes: the team (?group=) and the team Project
 * (?project=) a link into the Create Project wizard asked for. Pure. */

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
