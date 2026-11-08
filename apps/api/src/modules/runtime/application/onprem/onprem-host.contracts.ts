import type { ReadinessCheck } from './onprem-readiness.service';
import type { TunnelReportInput } from '../../domain/onprem-tunnel';
import type { BindingReportInput } from '../../domain/onprem-binding';

export interface MachineSummary {
  id: string;
  workspaceId: string;
  name: string;
  platform: 'windows' | 'ubuntu';
  agentVersion: string | null;
  lastSeenAt: string | null;
  status:
    | 'enrollment_pending'
    | 'connected'
    | 'prerequisites_failed'
    | 'offline'
    | 'revoked';
  checks: ReadinessCheck[];
}
export interface EnrollmentInput {
  name: string;
  platform: 'windows' | 'ubuntu';
  requestId: string;
  replacesMachineId?: string;
}
export interface MachineCheckIn {
  agentVersion: string;
  checks: ReadinessCheck[];
}
/** A heartbeat as the machine sent it: tunnel entries are validated by the service. */
export interface MachineHeartbeatInput extends MachineCheckIn {
  /** Every tunnel-mode assignment on the machine; absent from older agents. */
  tunnels?: unknown[];
  /** Every bound address on the machine; absent from agents before 0.5.0. */
  bindings?: unknown[];
}
/** A heartbeat with its tunnel and binding entries validated. */
export interface MachineHeartbeat extends MachineCheckIn {
  tunnels?: TunnelReportInput[];
  bindings?: BindingReportInput[];
}
/** A tunnel-mode assignment the machine must keep an HTTPS tunnel open for. */
export interface TunnelBinding {
  assignmentId: string;
  projectId: string;
  environmentId: string;
  hostPort: number;
}
/**
 * A bound address the machine must serve: a proxy site for `hostname` on port
 * 443 that forwards to `hostPort`. For an uploaded certificate the machine
 * fetches the files from `GET /onprem/certificates/:certificateId` whenever
 * the `sha256` it holds differs.
 */
export interface AddressBindingOrder {
  assignmentId: string;
  projectId: string;
  environmentId: string;
  hostPort: number;
  hostname: string;
  listenAddress: string | null;
  tls:
    | { kind: 'acme' }
    | { kind: 'internal' }
    | { kind: 'certificate'; certificateId: string; sha256: string };
}
export interface HeartbeatReply {
  /** Host ports reserved on the machine. */
  ports: number[];
  tunnels: TunnelBinding[];
  bindings: AddressBindingOrder[];
}
/** A machine's certificate download: the chain and its private key, as PEM. */
export interface MachineCertificate {
  id: string;
  sha256: string;
  certificatePem: string;
  privateKeyPem: string;
}
export interface InstallerRelease {
  version: string;
  url: string;
  sha256: string;
}
export interface EnrollmentReceipt {
  apiUrl: string;
  id: string;
  code: string;
  expiresAt: string;
  replacesMachineId: string | null;
  installer: InstallerRelease;
}
export interface EnrollmentResult {
  machine: MachineSummary;
  credential: string;
  apiUrl: string;
  trustKeys: Record<string, string>;
}
