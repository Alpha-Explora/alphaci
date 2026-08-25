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
