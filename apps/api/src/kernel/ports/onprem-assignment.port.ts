/** A stored assignment: every host port was allocated by AlphaCI on the machine. */
export interface AssignmentConfig {
  ports: Array<{
    slot: 'frontend' | 'backend';
    hostPort: number;
    containerPort: number;
  }>;
  health: Array<{ slot: 'frontend' | 'backend'; path: string | null }>;
  ingress: AssignmentIngress;
}
/**
 * How users reach the environment. `tunnel` has the machine create an HTTPS
 * address; its publicUrl is reported by the machine, never sent by a client.
 * `bound` has the machine serve the environment itself under the customer's
 * own name and certificate (an IIS-style binding); its publicUrl is derived
 * from the hostname by the server.
 */
export type AssignmentIngress =
  | { mode: 'direct' | 'configured' | 'tunnel'; publicUrl: string | null }
  | { mode: 'bound'; publicUrl: string | null; binding: AddressBinding };

/**
 * The certificate a bound address serves. `acme`: the machine's proxy obtains
 * a public certificate itself (needs public DNS and inbound 80 and 443).
 * `certificate`: one the workspace uploaded. `internal`: the proxy's private
 * CA, for labs; never accepted for production.
 */
export type BindingTls =
  | { kind: 'acme' }
  | { kind: 'internal' }
  | { kind: 'certificate'; certificateId: string };

/** The customer's own address for an environment, served on port 443. */
export interface AddressBinding {
  /** Lowercase DNS name, for example `orders.acme.local`. */
  hostname: string;
  /** The machine's local IP to listen on; null listens on every address. */
  listenAddress: string | null;
  tls: BindingTls;
}

/** The machine's latest state for a bound address. */
export type BindingStatus = 'starting' | 'running' | 'unavailable' | 'failed';
/** What the API shows: `waiting` until a fresh report arrives. */
export interface BindingReport {
  status: BindingStatus | 'waiting';
  message: string;
  reportedAt: string | null;
}
/**
 * What a client asks for. Host ports are chosen by the server inside the
 * assignment transaction; a `hostPort` sent by an older client is ignored.
 */
export interface AssignmentRequestConfig {
  ports: Array<{
    slot: 'frontend' | 'backend';
    containerPort: number;
    hostPort?: number;
  }>;
  health: AssignmentConfig['health'];
  ingress: AssignmentIngress;
}
/** The machine's latest state for a tunnel-mode assignment. */
export type TunnelStatus = 'starting' | 'running' | 'unavailable' | 'failed';
/** What the API shows: `waiting` until a fresh report arrives. */
export interface TunnelReport {
  status: TunnelStatus | 'waiting';
  /** The reported HTTPS address, only while its report is fresh. */
  publicUrl: string | null;
  message: string;
  reportedAt: string | null;
}
export interface OnpremAssignmentPort {
  /** Deny before provisioning side effects when managed-host delivery is absent. */
  assertAvailable(): void;
  /** `machineId` omitted: the workspace's only healthy machine is used. */
  assignProvisionedEnvironment(
    projectId: string,
    environmentId: string,
    userId: string,
    input: {
      machineId?: string;
      requestId: string;
      config: AssignmentRequestConfig;
    },
  ): Promise<{ assignmentId: string }>;
  /**
   * Assign an on-prem environment nobody configured to the workspace's only
   * healthy machine with default ports and health checks. Returns null when
   * that is not possible without a person's choice; never throws for that.
   */
  ensureAutomaticAssignment(
    projectId: string,
    environmentId: string,
    userId: string,
  ): Promise<{ assignmentId: string } | null>;
  /**
   * The address users reach an on-prem environment at: the machine's reported
   * tunnel address or the configured public URL. Null when there is none yet.
   */
  publicAddress(
    projectId: string,
    environmentId: string,
    slot: string,
  ): Promise<string | null>;
  /**
   * The address of the newest live host serving any of these environments:
   * its configured public URL, else a running tunnel's. Unlike publicAddress
   * it is not tied to a slot or to the release flag: an environment
   * pipeline's verify stage tests whatever the host serves. Null when no host
   * has an address yet.
   */
  environmentAddress(
    projectId: string,
    environmentIds: readonly string[],
  ): Promise<string | null>;
}
export const ONPREM_ASSIGNMENT = Symbol('OnpremAssignmentPort');
