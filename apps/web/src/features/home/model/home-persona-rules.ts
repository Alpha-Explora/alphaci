/* Who gets which Home, and whose Projects it covers. Pure: no React, no
 * fetch, no Next.
 *
 * Personas are an allow-list: every role is named. A role added later, or a
 * session with no role, keeps the team dashboard; it never inherits another
 * role's Home by being "not a member". */

import { NO_PROJECT_YET_MESSAGE } from "@/features/groups";
import { folderLandingProjectId } from "@/features/teams/project-folders";
import { APP_ROLE_BADGE_LABELS } from "@/shared/api/contracts";

import type {
  HomePersona,
  HomeRoleBadge,
  HomeScope,
  HomeSectionStates,
} from "./home-persona-types";
import { isEmptyWorkspace } from "./home-rules";
import type {
  AppRole,
  ProjectFolder,
  TeamQaOverview,
  TeamQaProject,
} from "./home-types";

const ROLE_PERSONAS: ReadonlyMap<string, HomePersona> = new Map<string, HomePersona>([
  ["member", "developer"],
  ["qa", "qa"],
  ["lead", "product-owner"],
  // An admin holds every Product owner power; the Product owner Home is what they act on.
  ["admin", "product-owner"],
]);

/**
 * The Home a role sees. The QA Team's Home is all QA, so with the QA
 * capability off it falls back to the team dashboard; the other roles keep
 * their Home and lose only its QA blocks (see homeLayoutFor).
 */
export function homePersonaFor(input: {
  appRole: AppRole | null | undefined;
  qaChecklistsEnabled: boolean;
}): HomePersona {
  const persona = ROLE_PERSONAS.get(input.appRole ?? "") ?? "team";
  if (persona === "qa" && !input.qaChecklistsEnabled) return "team";
  return persona;
}

const BADGE_ROLES: ReadonlySet<string> = new Set(Object.keys(APP_ROLE_BADGE_LABELS));

/** The role badge beside the Home greeting, or null for a session with no known role. */
export function homeRoleBadge(appRole: AppRole | null | undefined): HomeRoleBadge | null {
  if (!appRole || !BADGE_ROLES.has(appRole)) return null;
  return { role: appRole, label: APP_ROLE_BADGE_LABELS[appRole] };
}

/* ── Scope: "my Projects" ───────────────────────────────────────────────── */

/** The Project membership that makes a Project "mine". Product owners see the whole team. */
const PERSONA_MEMBERSHIP: Readonly<Record<HomePersona, "developer" | "qa" | null>> = {
  team: null,
  developer: "developer",
  qa: "qa",
  "product-owner": null,
};

const FALLBACK_LINES: Readonly<Record<HomePersona, string | null>> = {
  team: null,
  developer: "Your Product owner hasn't added you to a Project yet.",
  qa: "You haven't been added to a Project as QA yet.",
  "product-owner": null,
};

/** Every Project of the team: the Projects list first, then any only the overview names. */
export function teamProjectIds(
  folders: ReadonlyArray<ProjectFolder>,
  overview: TeamQaOverview | null,
): string[] {
  const ids = folders.map((folder) => folder.deliveryProjectId);
  const extra = (overview?.projects ?? []).map((project) => project.deliveryProject.id);
  return [...new Set([...ids, ...extra])];
}

/**
 * Whose Projects the role's blocks cover. A Developer's (or QA member's)
 * Projects are those they are a member of in that role, from the overview's
 * `viewerMembership`. Nobody is a member of anything yet, so an empty set
 * falls back to the whole team, and says so. Without the overview the
 * membership is not known, and the blocks cover the team without the line.
 */
export function homeScopeFor(input: {
  persona: HomePersona;
  folders: ReadonlyArray<ProjectFolder>;
  overview: TeamQaOverview | null;
}): HomeScope {
  const team = teamProjectIds(input.folders, input.overview);
  const membership = PERSONA_MEMBERSHIP[input.persona];
  if (!membership || !input.overview) return { mode: "team", projectIds: team };
  const mine = input.overview.projects
    .filter((project) => project.viewerMembership === membership)
    .map((project) => project.deliveryProject.id);
  if (mine.length > 0) return { mode: "mine", projectIds: mine };
  return { mode: "fallback", projectIds: team };
}

/** The line a fallback scope carries, or null. */
export function scopeFallbackLine(persona: HomePersona, scope: HomeScope): string | null {
  return scope.mode === "fallback" ? FALLBACK_LINES[persona] : null;
}

export function foldersInScope(
  folders: ReadonlyArray<ProjectFolder>,
  scope: HomeScope,
): ProjectFolder[] {
  const ids = new Set(scope.projectIds);
  return folders.filter((folder) => ids.has(folder.deliveryProjectId));
}

export function qaProjectsInScope(overview: TeamQaOverview | null, scope: HomeScope): TeamQaProject[] {
  const ids = new Set(scope.projectIds);
  return (overview?.projects ?? []).filter((project) => ids.has(project.deliveryProject.id));
}

/* ── Links (ALPHACI pages only) ─────────────────────────────────────────── */

const enc = encodeURIComponent;

export function deliveryProjectHref(groupId: string, deliveryProjectId: string): string {
  return `/groups/${enc(groupId)}/delivery-projects/${enc(deliveryProjectId)}`;
}

export function projectPageHref(projectId: string): string {
  return `/projects/${enc(projectId)}`;
}

/** Where a block's Project rows link: the team, and its Projects by id. */
export interface HomeLinkContext {
  groupId: string;
  folders: ReadonlyMap<string, ProjectFolder>;
}

export function homeLinkContext(groupId: string, folders: ReadonlyArray<ProjectFolder>): HomeLinkContext {
  return { groupId, folders: new Map(folders.map((folder) => [folder.deliveryProjectId, folder])) };
}

/**
 * A Project's QA Studio (`qa`) or PO Studio (`po`): a tab on the repository
 * page the Project opens on (its frontend, else its first linked repository).
 * A Project with no linked repository has no studio yet, so the row opens the
 * Project page instead.
 */
export function projectStudioHref(
  links: HomeLinkContext,
  deliveryProjectId: string,
  tab: "qa" | "po",
): string {
  const folder = links.folders.get(deliveryProjectId);
  const landing = folder ? folderLandingProjectId(folder) : null;
  if (landing) return `${projectPageHref(landing)}#${tab}`;
  return deliveryProjectHref(links.groupId, deliveryProjectId);
}

/* ── An empty team ──────────────────────────────────────────────────────── */

export const WAITING_FOR_FIRST_PROJECT = "Waiting for your Product owner to create the first Project.";

/** "No Projects yet" under a Developer's empty My work. */
export const MY_WORK_EMPTY_LINE = NO_PROJECT_YET_MESSAGE;

/**
 * What an empty team shows: the get-started journey to whoever can start it
 * (a Product owner or admin, and the team dashboard), one calm waiting card
 * to a Developer or the QA Team, who cannot create a Project.
 */
export function homeEmptyStateFor(persona: HomePersona): "journey" | "waiting" {
  return persona === "developer" || persona === "qa" ? "waiting" : "journey";
}

/**
 * Whether a role's Home is for an empty team: no repositories and no
 * Projects, once both are read. A Projects list that failed to load says
 * nothing about emptiness, so it never shows the empty state.
 */
export function isPersonaHomeEmpty(input: {
  states: Pick<HomeSectionStates, "projects" | "folders">;
  projectCount: number;
  teamProjectCount: number;
}): boolean {
  const { projects, folders } = input.states;
  if (folders.status === "error") return false;
  return isEmptyWorkspace({
    loading: projects.status === "loading" || folders.status === "loading",
    projectCount: input.projectCount,
    deliveryProjectCount: input.teamProjectCount,
  });
}
