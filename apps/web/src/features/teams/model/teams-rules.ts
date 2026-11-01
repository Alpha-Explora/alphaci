/* Pure rules for the teams domain. No React, no Next, no fetch. */
import { ApiError } from "@/shared/api/request";

import type { Team } from "./teams-types";

/**
 * Which team this page shows.
 *
 * The header owns the selection, but fall back to the first team so the page is
 * never blank merely because nothing has been picked yet this session. Resolved
 * as a rule rather than at render time because the project fetch is scoped to
 * whatever this returns.
 */
export function resolveSelectedTeam(
  teams: readonly Team[] | null,
  selectedId: string | null,
): Team | null {
  const list = teams ?? [];
  return list.find((team) => team.id === selectedId) ?? list[0] ?? null;
}

/** Plural-aware member count, e.g. "1 member" / "4 members". */
export function memberCountLabel(count: number): string {
  return `${count} ${count === 1 ? "member" : "members"}`;
}

const GENERIC_LOAD_ERROR = "Could not load this team.";

/**
 * Map a thrown value to a message safe to render.
 *
 * The route collapsed every failure into one string, so a signed-out session
 * and a deleted team read identically. Views receive this, never the error.
 */
export function toUserError(err: unknown): string {
  if (!(err instanceof ApiError)) return GENERIC_LOAD_ERROR;

  switch (err.status) {
    case 401:
      return "Your session expired. Please sign in again.";
    case 403:
      return "You do not have access to this team.";
    case 404:
      return "This team no longer exists.";
    default:
      return GENERIC_LOAD_ERROR;
  }
}

/** What a /teams link asks to open. Every field is optional in the URL. */
export interface TeamsDeepLink {
  workspaceId: string | null;
  section: string | null;
  checklistId: string | null;
  /** A Project (hierarchy delivery project) to open in the explorer. */
  projectId: string | null;
}

export const EMPTY_TEAMS_DEEP_LINK: TeamsDeepLink = {
  workspaceId: null,
  section: null,
  checklistId: null,
  projectId: null,
};

/** `?section=projects`: the team's Projects explorer (now the Projects page). */
export const TEAMS_PROJECTS_SECTION = "projects";

/**
 * Read `?workspace=…&section=…&checklist=…&project=…` from a location search
 * string. The team pages read it once on arrival, through useSearchParams.
 */
export function parseTeamsDeepLink(search: string): TeamsDeepLink {
  const params = new URLSearchParams(search);
  return {
    workspaceId: params.get("workspace") || null,
    section: params.get("section") || null,
    checklistId: params.get("checklist") || null,
    projectId: params.get("project") || null,
  };
}

/**
 * Whether a link opens the Projects section: by naming it, or by naming a
 * Project (`?project=` alone is enough — a Project only lives there).
 */
export function linksToProjects(deepLink: TeamsDeepLink | null | undefined): boolean {
  return deepLink?.section === TEAMS_PROJECTS_SECTION || Boolean(deepLink?.projectId);
}

/**
 * The item a link opens on this team (a checklist, a Project), or null. A
 * link made for another team must not open a same-id item here, so a named
 * team has to match; a link that names no team applies to whichever team is
 * on screen.
 */
export function linkedItemId(
  itemId: string | null | undefined,
  linkedTeamId: string | null | undefined,
  teamId: string,
): string | null {
  if (!itemId) return null;
  if (linkedTeamId && linkedTeamId !== teamId) return null;
  return itemId;
}

/* ── Where the old /teams sections live now ──────────────────────────────── */

/** The team pages, one per former section of the team rail. */
export const TEAM_PAGE_PATHS = {
  members: "/teams",
  checklists: "/checklists",
  activity: "/activity",
  settings: "/settings",
  projects: "/workflows",
} as const;

/** `/settings?tab=team`: the Settings page opened on its Team tab. */
export const SETTINGS_TEAM_TAB = "team";

function withQuery(path: string, entries: Array<[string, string | null]>): string {
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * Where an old `/teams?section=…` link goes now, or null to stay on /teams.
 *
 * The team rail is gone: each of its sections is a page of its own, so a link
 * minted before the split (a bookmark, an email, a notification, another
 * page's "Manage" link) is forwarded rather than landing on Members. The team
 * the link named rides along, so the destination opens on the same team.
 * Members and Overview are what /teams is now, so they stay.
 */
export function legacyTeamsRedirect(deepLink: TeamsDeepLink): string | null {
  const { workspaceId, section, checklistId, projectId } = deepLink;
  if (section === "qa-checklists") {
    return withQuery(TEAM_PAGE_PATHS.checklists, [
      ["workspace", workspaceId],
      ["checklist", checklistId],
    ]);
  }
  if (section === "activity") {
    return withQuery(TEAM_PAGE_PATHS.activity, [["workspace", workspaceId]]);
  }
  if (section === "settings") {
    return withQuery(TEAM_PAGE_PATHS.settings, [
      ["tab", SETTINGS_TEAM_TAB],
      ["workspace", workspaceId],
    ]);
  }
  if (linksToProjects(deepLink)) {
    return withQuery(TEAM_PAGE_PATHS.projects, [
      ["group", workspaceId],
      ["project", projectId],
    ]);
  }
  return null;
}

/**
 * Team roles that may change the team itself (rename, transfer the Lead,
 * archive, delete): its Lead (wire value "admin") and a Delegated lead. An
 * allow-list, so a role added later (qa, …) gets no power until named here.
 * The backend reports "admin" for app-role leads and admins on their teams,
 * and for a platform admin on any team, so this is also "lead/admin only".
 */
const TEAM_SETTINGS_ROLES: ReadonlySet<string> = new Set(["admin", "delegated_lead"]);

/** Whether the Settings page shows the Team tab for a team the caller holds this role in. */
export function canManageTeamSettings(teamRole: string | null | undefined): boolean {
  return Boolean(teamRole) && TEAM_SETTINGS_ROLES.has(teamRole as string);
}

/** The Members page for one team. */
export function teamMembersHref(workspaceId?: string | null): string {
  return withQuery(TEAM_PAGE_PATHS.members, [["workspace", workspaceId ?? null]]);
}
