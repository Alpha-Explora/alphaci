/* Project members: who may manage them, who may be added, and what each
 * change does on GitHub. Pure: no React, no fetch.
 *
 * Mirrors the backend (DeliveryProjectMembersService): leads and admins
 * manage; Developers (app role `member`) and QA Team (`qa`) are the only
 * people a Project holds; a Developer's membership carries GitHub Write on
 * the repositories CREATED in the Project, QA's carries none. */
import type { AppRole } from "@/shared/api/contracts";
import { ApiError } from "@/shared/api/request";

import type {
  DeliveryProjectMember,
  DeliveryProjectMemberKind,
  GroupMember,
  ProjectMemberGithubAccess,
} from "../data/hierarchy-contracts";

type Role = AppRole | null | undefined;

/** Allow-list: a role added later manages nothing until it is named here. */
const MEMBER_MANAGERS: ReadonlyArray<AppRole> = ["lead", "admin"];

/**
 * Whether the caller manages this Project's members. The list endpoint itself
 * is lead/admin only, so nobody else gets a panel (not even read-only).
 */
export function canManageProjectMembers(appRole: Role): boolean {
  return appRole !== null && appRole !== undefined && MEMBER_MANAGERS.includes(appRole);
}

export const MEMBER_KIND_LABELS: Readonly<Record<DeliveryProjectMemberKind, string>> = {
  developer: "Developer",
  qa: "QA Team",
};

/** The kind a team member would join as, or null when their app role is unknown. */
export function candidateKind(member: Pick<GroupMember, "appRole">): DeliveryProjectMemberKind | null {
  if (member.appRole === "member") return "developer";
  if (member.appRole === "qa") return "qa";
  return null;
}

/**
 * Leads and admins are never Project members. With the app role known, only
 * Developers and QA Team qualify; without it, team managers are left out and
 * the server decides the rest (PROJECT_MEMBER_ROLE_NOT_ALLOWED).
 */
function isEligibleRole(member: GroupMember): boolean {
  if (member.appRole) return candidateKind(member) !== null;
  return member.role !== "admin" && member.role !== "delegated_lead";
}

/** Active team members who could join: no leads/admins, nobody already in. */
export function eligibleProjectMemberCandidates(
  teamMembers: ReadonlyArray<GroupMember>,
  projectMembers: ReadonlyArray<DeliveryProjectMember>,
): GroupMember[] {
  const inProject = new Set(
    projectMembers.filter((member) => member.status === "active").map((member) => member.userId),
  );
  return teamMembers.filter(
    (member) =>
      member.memberStatus === "active" && isEligibleRole(member) && !inProject.has(member.userId),
  );
}

export function memberDisplayName(member: Pick<DeliveryProjectMember, "name" | "login">): string {
  return member.name || member.login || "Member";
}

/* ── Copy ─────────────────────────────────────────────────────────────── */

export const DEVELOPER_ACCESS_NOTE =
  "Developers get Write on every repository created in this Project, including ones created later. " +
  "Repositories attached from an existing GitHub repository, or moved here from another Project, " +
  "are not granted automatically: a lead grants access per repository.";

export const QA_ACCESS_NOTE =
  "QA Team get no GitHub write access. They run Playwright in QA Studio through ALPHACI.";

export const STUB_SYNC_NOTE = "GitHub access is granted once live GitHub sync is switched on.";

export const RESYNC_NOTE =
  "Re-sync re-applies Developers' Write on the repositories created in this Project. Attached repositories are skipped.";

function repositories(count: number): string {
  return count === 1 ? "1 repository" : `${count} repositories`;
}

/** What an add did on GitHub, as one sentence for the panel. */
export function addedMessage(
  member: DeliveryProjectMember,
  access: ProjectMemberGithubAccess,
): string {
  const name = memberDisplayName(member);
  if (member.memberKind === "qa") return `${name} joined as QA Team. ${QA_ACCESS_NOTE}`;
  if (access.syncMode !== "live") return `${name} joined as a Developer. ${STUB_SYNC_NOTE}`;
  if (access.repositoriesQueued > 0) {
    return `${name} joined as a Developer. Granting Write on ${repositories(access.repositoriesQueued)}…`;
  }
  return `${name} joined as a Developer. Write is granted on each repository created in this Project.`;
}

/** What a removal did on GitHub. */
export function removedMessage(
  member: DeliveryProjectMember,
  access: ProjectMemberGithubAccess,
): string {
  const name = memberDisplayName(member);
  if (member.memberKind === "developer" && access.syncMode === "live" && access.repositoriesQueued > 0) {
    return `${name} was removed. Removing Write from ${repositories(access.repositoriesQueued)}…`;
  }
  return `${name} was removed from this Project.`;
}

export function resyncedMessage(repositoriesQueued: number): string {
  return repositoriesQueued > 0
    ? `Granting Write on ${repositories(repositoriesQueued)}…`
    : "Every Developer already has Write on this Project's repositories.";
}

/* ── Refusals ─────────────────────────────────────────────────────────── */

export type MemberAction = "load" | "add" | "remove" | "sync";

const CODE_MESSAGES: Readonly<Record<string, string>> = {
  PROJECT_MEMBER_ROLE_NOT_ALLOWED:
    "Leads and admins already manage every repository in the team, so they aren't added to a Project.",
  PROJECT_MEMBER_NOT_IN_TEAM:
    "That person isn't an active member of this Project's team. Add them to the team first.",
  PROJECT_ARCHIVED: "This Project is archived. Reopen it before changing its members.",
  PROJECT_MEMBER_NOT_FOUND: "That person is no longer a member of this Project.",
};

const FALLBACKS: Readonly<Record<MemberAction, string>> = {
  load: "Project members could not be loaded.",
  add: "The member could not be added. Please try again.",
  remove: "The member could not be removed. Please try again.",
  sync: "GitHub access could not be re-synced. Please try again.",
};

/** The upper-cased `code` of an ApiError body, or "" for anything else. */
export function apiErrorCode(cause: unknown): string {
  if (!(cause instanceof ApiError)) return "";
  const body = cause.details;
  if (typeof body !== "object" || body === null || !("code" in body)) return "";
  const { code } = body as { code: unknown };
  return typeof code === "string" ? code.toUpperCase() : "";
}

function statusMessage(cause: unknown): string | null {
  if (!(cause instanceof ApiError)) return null;
  if (cause.status === 403) return "Only the team's leads and admins can change Project members.";
  if (cause.status === 404) return "This Project no longer exists, or it isn't in your team.";
  if (cause.status === 503) return `GitHub access can't be re-synced yet. ${STUB_SYNC_NOTE}`;
  return null;
}

/** One clear sentence for a failed members call. */
export function projectMemberErrorMessage(cause: unknown, action: MemberAction): string {
  return CODE_MESSAGES[apiErrorCode(cause)] ?? statusMessage(cause) ?? FALLBACKS[action];
}
