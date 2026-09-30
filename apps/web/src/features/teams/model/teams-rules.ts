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

/** `?section=projects`: the team's Projects explorer. */
export const TEAMS_PROJECTS_SECTION = "projects";

/**
 * Read `?workspace=…&section=…&checklist=…&project=…` from a location search
 * string.
 *
 * Parsed from a plain string so the page does not need useSearchParams (and
 * the Suspense boundary it demands) for a value read once on arrival.
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
 * The Project a link opens on this team, or null. A link made for another
 * team must not open a same-id Project here, so a named team has to match;
 * a link that names no team applies to whichever team is on screen.
 */
export function linkedFolderId(
  deepLink: TeamsDeepLink | null | undefined,
  teamId: string,
): string | null {
  if (!deepLink?.projectId) return null;
  if (deepLink.workspaceId && deepLink.workspaceId !== teamId) return null;
  return deepLink.projectId;
}
