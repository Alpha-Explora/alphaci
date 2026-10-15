export interface ReadinessCheck {
  id: string;
  status: "passed" | "failed" | "unverified";
  message: string;
}
export interface MachineSummary {
  id: string;
  workspaceId: string;
  name: string;
  platform: "windows" | "ubuntu";
  agentVersion: string | null;
  lastSeenAt: string | null;
  status:
    | "enrollment_pending"
    | "connected"
    | "prerequisites_failed"
    | "offline"
    | "revoked";
  checks: ReadinessCheck[];
}
export interface EnrollmentReceipt {
  apiUrl: string;
  id: string;
  code: string;
  expiresAt: string;
  /** Set when this code replaces the credential of an enrolled machine. */
  replacesMachineId?: string | null;
  installer: { version: string; url: string; sha256: string };
}
export type AssignmentConfig =
  import("@/shared/api/contracts").OnpremAssignmentConfig;
export interface MachineAssignment {
  id: string;
  machineId: string;
  projectId: string;
  environmentId: string;
  revision: number;
  config: AssignmentConfig;
}
export type HostAssignment =
  | MachineAssignment
  | {
      id: string;
      machineId: null;
      projectId: string;
      environmentId: string;
      revision: number;
      config: null;
      name: string;
    };
export function hostConnectionLabel(
  host: MachineSummary,
  now = Date.now(),
): string {
  if (host.status === "revoked") return "Revoked";
  if (host.status === "enrollment_pending") return "Awaiting enrollment";
  if (!host.lastSeenAt || now - Date.parse(host.lastSeenAt) > 90_000)
    return "Offline";
  return host.status === "prerequisites_failed"
    ? "Prerequisites failed"
    : "Connected";
}
export function canManageHosts(
  appRole: string | undefined,
  workspaceRole: string | null | undefined,
) {
  return (
    (appRole === "admin" || appRole === "member") &&
    Boolean(workspaceRole) &&
    workspaceRole !== "viewer"
  );
}
