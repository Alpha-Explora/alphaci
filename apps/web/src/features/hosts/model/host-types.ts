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
export type AssignmentRequestConfig =
  import("@/shared/api/contracts").OnpremAssignmentRequestConfig;
export type TunnelReport = import("@/shared/api/contracts").TunnelReport;
export interface MachineAssignment {
  id: string;
  machineId: string;
  projectId: string;
  environmentId: string;
  revision: number;
  config: AssignmentConfig;
  /** The machine's tunnel report; null unless config.ingress.mode is "tunnel". */
  tunnel: TunnelReport | null;
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
/** Machines AlphaCI assigns to: enrolled, checking in, not revoked. */
export function healthyHosts(hosts: readonly MachineSummary[]) {
  return hosts.filter(
    (host) =>
      host.status === "connected" || host.status === "prerequisites_failed",
  );
}
/** The request part of a stored config: everything except host ports. */
export function requestedConfig(
  config: AssignmentConfig | AssignmentRequestConfig,
): AssignmentRequestConfig {
  return {
    ...config,
    ports: config.ports.map(({ slot, containerPort }) => ({
      slot,
      containerPort,
    })),
  };
}
/** Shown while the machine has not reported a tunnel address and said nothing else. */
export const TUNNEL_WAITING_MESSAGE =
  "Waiting for the machine to report its address";
/** Where an assignment's environment is reached, as the summary shows it. */
export type ReachedAt =
  | { kind: "link"; href: string }
  | { kind: "text"; text: string };
export function reachedAt(
  config: AssignmentConfig,
  tunnel: TunnelReport | null,
): ReachedAt {
  const { ingress } = config;
  if (ingress.mode === "configured" && ingress.publicUrl)
    return { kind: "link", href: ingress.publicUrl };
  if (ingress.mode === "tunnel") {
    if (tunnel?.publicUrl) return { kind: "link", href: tunnel.publicUrl };
    return {
      kind: "text",
      text: tunnel?.message.trim() || TUNNEL_WAITING_MESSAGE,
    };
  }
  return { kind: "text", text: "host port on the local network" };
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
export type HostPlatform = MachineSummary["platform"];
export type HostTone = "success" | "danger" | "amber" | "muted" | "brand";
export function hostStatusTone(label: string): HostTone {
  if (label === "Connected") return "success";
  if (label === "Prerequisites failed") return "danger";
  if (label === "Awaiting enrollment") return "brand";
  if (label === "Offline") return "amber";
  return "muted";
}
/**
 * Where a freshly issued enrollment stands. The pending row carries the
 * enrollment's id; once the installer consumes the code that row disappears
 * and a machine row (new id, same name) takes its place.
 */
export type EnrollmentProgress = "waiting" | "connected" | "expired";
export function enrollmentProgress(
  receipt: { id: string; expiresAt: string },
  name: string,
  hosts: MachineSummary[],
  now = Date.now(),
): EnrollmentProgress {
  const stillPending = hosts.some(
    (host) => host.id === receipt.id && host.status === "enrollment_pending",
  );
  const machine = hosts.some(
    (host) =>
      host.name === name &&
      host.status !== "enrollment_pending" &&
      host.status !== "revoked",
  );
  if (!stillPending && machine) return "connected";
  if (Date.parse(receipt.expiresAt) <= now) return "expired";
  return "waiting";
}
export interface PlatformGuide {
  label: string;
  summary: string;
  prerequisites: string[];
  runIn: string;
}
export const PLATFORM_GUIDES: Record<HostPlatform, PlatformGuide> = {
  windows: {
    label: "Windows",
    summary: "Windows 10/11 or Server with Ubuntu on WSL2",
    prerequisites: [
      "Ubuntu installed in WSL2 with systemd enabled",
      "Docker Engine and Docker Compose running inside Ubuntu",
      "Administrator access on the machine",
    ],
    runIn:
      "Paste it into Windows PowerShell opened as Administrator (the prompt starts with PS C:\\>), signed in as the account that owns Ubuntu. Do not open Ubuntu or type wsl first; the installer sets up Ubuntu for you.",
  },
  ubuntu: {
    label: "Ubuntu",
    summary: "Ubuntu server, VM, or desktop",
    prerequisites: [
      "Ubuntu 22.04 or newer with systemd",
      "Docker Engine and Docker Compose running",
      "A user that can run sudo",
    ],
    runIn: "Open a terminal on the machine and paste the command.",
  },
};
export function lastSeenLabel(lastSeenAt: string | null, now = Date.now()) {
  if (!lastSeenAt) return "Never connected";
  const seconds = Math.max(
    0,
    Math.round((now - Date.parse(lastSeenAt)) / 1000),
  );
  if (seconds < 60) return "Seen just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Seen ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Seen ${hours} h ago`;
  return `Seen ${new Date(lastSeenAt).toLocaleDateString()}`;
}
export function countdownLabel(expiresAt: string, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
