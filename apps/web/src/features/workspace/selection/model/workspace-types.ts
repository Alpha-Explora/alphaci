import { APP_ROLE_BADGE_LABELS, type AppRole } from "@/shared/api/contracts";

export type WorkspaceRole = "admin" | "delegated_lead" | "member" | "viewer";

export interface WorkspaceSummary {
  id: string;
  name: string;
  kind: "personal" | "team";
  role: WorkspaceRole;
}

export interface WorkspacesMeResponse {
  enabled: boolean;
  items: WorkspaceSummary[];
}

/** The global app role; one definition, owned by the API contract. */
export type WorkspaceAppRole = AppRole;

export { APP_ROLE_BADGE_LABELS };

/** Only Team leads and Admins create workspaces; QA Team and Developers cannot. */
export function canCreateWorkspace(appRole: WorkspaceAppRole | null | undefined) {
  return appRole === "admin" || appRole === "lead";
}

export type WorkspaceSwitcherKind =
  | "error"
  | "disabled"
  | "loading"
  | "no-team"
  | "create"
  | "picker";

/**
 * Which header slot to show. Order is the product rule: a failed load must
 * never look like "feature off", and a lead with no team must never land on
 * the developer notice.
 */
export function workspaceSwitcherKind(
  status: "idle" | "loading" | "ready" | "error",
  workspaces: WorkspacesMeResponse | null,
  /** Every selectable team, an admin's other teams included. */
  itemCount: number,
  canCreate: boolean,
): WorkspaceSwitcherKind {
  if (status === "error") return "error";
  if (workspaces?.enabled === false) return "disabled";
  if (status === "loading" || workspaces === null) return "loading";
  if (itemCount === 0 && !canCreate) return "no-team";
  if (itemCount === 0) return "create";
  return "picker";
}

export function navAvatarInitial(session: {
  user: { name?: string; login?: string };
} | null): string {
  return (session?.user.name ?? session?.user.login ?? "U")
    .slice(0, 1)
    .toUpperCase();
}

export function isPlatformAdminUser(
  guest: boolean,
  session: { appRole?: string; platformRole?: string | null } | null,
): boolean {
  if (guest) return false;
  return session?.appRole === "admin" || session?.platformRole === "super_admin";
}

/** The heading the header picker files a platform admin's non-member teams under. */
export const OTHER_TEAMS_HEADING = "Other teams (admin)";

/**
 * The teams a platform admin can see but is not a member of.
 *
 * `/groups` hands an admin EVERY team; `/workspaces/me` only the ones they
 * belong to. The difference is what the header lists under "Other teams
 * (admin)" — without it an admin could no longer reach a team like "Johns
 * Kitchen" once the Projects page stopped carrying its own team dropdown.
 * Sorted by name so a long list is scannable; the role is the one the backend
 * reports for an admin on a team they do not belong to.
 */
export function adminOtherTeams(
  memberTeams: readonly Pick<WorkspaceSummary, "id">[],
  allTeams: readonly { id: string; name: string }[],
): WorkspaceSummary[] {
  const memberIds = new Set(memberTeams.map((team) => team.id));
  return allTeams
    .filter((team) => !memberIds.has(team.id))
    .map((team) => ({ id: team.id, name: team.name, kind: "team" as const, role: "admin" as const }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every team the header can select: the caller's own, then an admin's others. */
export function selectableWorkspaces(
  workspaces: WorkspacesMeResponse | null,
  otherTeams: readonly WorkspaceSummary[],
): WorkspaceSummary[] {
  return [...(workspaces?.items ?? []), ...otherTeams];
}

/** The primary sidebar entries, in order. */
export type SidebarMainItem = "home" | "projects" | "teams" | "checklists" | "activity" | "inbox";


/**
 * The platform roles the backend treats as a platform admin
 * (HierarchyAccessService.isPlatformAdmin): any platform_admins row, whatever
 * its role. Kept as an explicit list for the same reason as above.
 */
const PLATFORM_ADMIN_ROLES: ReadonlySet<string> = new Set(["admin", "super_admin"]);

/**
 * Whether the caller can open /activity for the team selected in the header.
 * The backend lets a platform admin (a platform_admins row, or the global
 * `admin` app role) read any team's feed, and otherwise only the team's Lead
 * or Delegated lead. Everyone else gets a 403, so the sidebar should not offer
 * them the page. Before the team list resolves (`teamRole` null) only the
 * admin case can say yes.
 */
export function canOpenTeamActivity(input: {
  guest: boolean;
  appRole?: WorkspaceAppRole | null;
  platformRole?: string | null;
  teamRole?: WorkspaceRole | null;
}): boolean {
  if (input.guest) return false;
  if (input.appRole === "admin") return true;
  if (input.platformRole && PLATFORM_ADMIN_ROLES.has(input.platformRole)) return true;
  // The backend derives the team role from the global app role (lead/admin ->
  // team admin) for active members, so the stored per-team role must not
  // decide: a stored delegated_lead whose app role is member is refused, and a
  // lead whose stored role is member is allowed. teamRole only proves the user
  // belongs to the selected team.
  return input.appRole === "lead" && Boolean(input.teamRole);
}

/**
 * Which Main entries the sidebar shows. Checklists follows the same backend
 * capability that gated the old team rail's "Checklist templates"; Activity
 * follows canOpenTeamActivity, so a QA Team member or Developer is not sent to
 * a page that can only tell them they have no access. Teams and Inbox only
 * hide for guests.
 */
export function sidebarMainItems(input: {
  guest: boolean;
  qaChecklistsEnabled: boolean;
  /** canOpenTeamActivity for the header team. */
  canOpenActivity: boolean;
}): SidebarMainItem[] {
  const items: SidebarMainItem[] = ["home", "projects"];
  if (input.guest) return items;
  items.push("teams");
  if (input.qaChecklistsEnabled) items.push("checklists");
  if (input.canOpenActivity) items.push("activity");
  items.push("inbox");
  return items;
}

export function sessionAppRole(
  session: { appRole?: WorkspaceAppRole } | null,
): WorkspaceAppRole {
  return session?.appRole ?? "member";
}

export function reducedMotionEnabled(value: boolean | null): boolean {
  return value ?? false;
}
