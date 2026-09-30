/* The Projects view of /workflows: which team it shows, which Project a link
 * opens, and which team the create view preselects. Pure. */

/** Shape-only id check; membership is decided against real data later. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,100}$/;

function safeId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return SAFE_ID.test(trimmed) ? trimmed : null;
}

/**
 * The team the Projects view shows: always the header's selection. Falls back
 * to the first team only while the header has not resolved a selection that
 * this list knows, so the page is never blank merely because nothing has been
 * picked yet this session.
 */
export function headerTeam<T extends { id: string }>(
  teams: readonly T[],
  headerWorkspaceId: string | null | undefined,
): T | null {
  return teams.find((team) => team.id === headerWorkspaceId) ?? teams[0] ?? null;
}

/** What a `/workflows?group=…&project=…` link asks the Projects view for. */
export interface ProjectsDeepLink {
  /** A team to select in the header on arrival. */
  groupId: string | null;
  /** A Project (hierarchy delivery project) to open in the explorer. */
  projectId: string | null;
  /**
   * `?tab=setup`: the link is for the Create Project wizard, which reads
   * `?group=` and `?project=` as where to create — not what to open.
   */
  opensSetup: boolean;
}

export function readProjectsDeepLink(params: {
  get: (key: string) => string | null;
}): ProjectsDeepLink {
  return {
    groupId: safeId(params.get("group")),
    projectId: safeId(params.get("project")),
    opensSetup: params.get("tab") === "setup",
  };
}

/**
 * The Project to open on arrival, on this team, or null.
 *
 * This is where the project page's "Manage project" and a forwarded
 * `/teams?section=projects&project=…` land. A link that names another team
 * must not open a same-id Project here, and a wizard link's `?project=` is a
 * create target, never something to open.
 */
export function linkedProjectFolderId(link: ProjectsDeepLink, teamId: string): string | null {
  if (link.opensSetup || !link.projectId) return null;
  if (link.groupId && link.groupId !== teamId) return null;
  return link.projectId;
}

/**
 * Where focus moves inside the "⋯" create menu for a key, or null when the
 * key is not a menu movement. Up/Down wrap, as the WAI-ARIA menu pattern
 * expects; Home/End jump to the ends.
 */
export function nextMenuIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  if (key === "ArrowDown") return current < 0 ? 0 : (current + 1) % count;
  if (key === "ArrowUp") return current < 0 ? count - 1 : (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

/** The team the create view preselects for a group, kept only when the caller can create in it. */
export function createWorkspaceForGroup(
  groupId: string | null,
  workspaces: readonly { id: string }[] | null,
  current: string | null,
): string | null {
  if (!groupId) return current;
  // Unknown list: take the group; the workspace load keeps an existing choice.
  if (workspaces === null) return groupId;
  return workspaces.some((workspace) => workspace.id === groupId) ? groupId : current;
}
