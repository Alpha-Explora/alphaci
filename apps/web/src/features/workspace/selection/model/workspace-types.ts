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

export type WorkspaceAppRole = "admin" | "lead" | "member";

export const APP_ROLE_BADGE_LABELS: Record<WorkspaceAppRole, string> = {
  admin: "Admin",
  lead: "Team lead",
  member: "Developer",
};

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

export function sessionAppRole(
  session: { appRole?: WorkspaceAppRole } | null,
): WorkspaceAppRole {
  return session?.appRole ?? "member";
}

export function reducedMotionEnabled(value: boolean | null): boolean {
  return value ?? false;
}
