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
