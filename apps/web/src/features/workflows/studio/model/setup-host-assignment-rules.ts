import type { EnvironmentDraft } from "./project-environments-rules";

/**
 * The problem with each environment's on-prem host assignment, in the order
 * of `environments`: null where it is fine or has no machine.
 */
export function setupHostAssignmentProblems(
  environments: readonly EnvironmentDraft[],
): (string | null)[] {
  return environments.map(assignmentProblem);
}

/** The first problem with the on-prem host assignments, or null. */
export function setupHostAssignmentsProblem(
  environments: readonly EnvironmentDraft[],
): string | null {
  return (
    setupHostAssignmentProblems(environments).find(
      (problem) => problem !== null,
    ) ?? null
  );
}

function assignmentProblem(environment: EnvironmentDraft): string | null {
  const binding = environment.hostAssignment;
  if (!binding) return null;
  if (environment.runsOn !== "onprem")
    return "Assign machines only to on-prem environments.";
  // Host ports are allocated by AlphaCI on the machine; only the
  // container's own port is chosen here.
  if (
    binding.config.ports.some(
      (port) =>
        !Number.isInteger(port.containerPort) ||
        port.containerPort < 1 ||
        port.containerPort > 65535,
    )
  )
    return "Use whole container port numbers from 1 to 65535.";
  if (
    binding.config.health.some(
      (item) => !item.path?.startsWith("/") || item.path.startsWith("//"),
    )
  )
    return "Enter an application health path, or choose Assign later.";
  return productionIngressProblem(environment);
}

function productionIngressProblem(environment: EnvironmentDraft) {
  const binding = environment.hostAssignment;
  if (environment.role !== "production" || !binding) return null;
  // The machine creates a tunnel's HTTPS address, so the mode itself meets the
  // requirement; the address shows up once the machine reports it.
  const { mode, publicUrl } = binding.config.ingress;
  if (mode === "tunnel") return null;
  if (mode === "configured" && publicUrl?.startsWith("https://")) return null;
  return "Add an HTTPS URL or choose the automatic HTTPS address for Production, or choose Assign later.";
}

/** A slot an on-prem host runs: the backend or the frontend container. */
export type HostSlot = "frontend" | "backend";

type HostAssignment = NonNullable<EnvironmentDraft["hostAssignment"]>;
type HostAssignmentConfig = HostAssignment["config"];

/** The container port a slot starts with: 3000 for a frontend, 4000 for a backend. */
export function defaultContainerPort(slot: HostSlot): number {
  return slot === "frontend" ? 3000 : 4000;
}

/**
 * A new assignment with defaults: one container port and one health path per
 * slot, because the backend wants exactly one of each for every slot the
 * environment deploys. No machine means the only connected one.
 */
export function defaultHostAssignment(
  environment: EnvironmentDraft,
  slots: readonly HostSlot[],
  machineId?: string,
): HostAssignment {
  return {
    ...(machineId ? { machineId } : {}),
    requestId: crypto.randomUUID(),
    config: {
      ports: slots.map((slot) => ({ slot, containerPort: defaultContainerPort(slot) })),
      health: slots.map((slot) => ({ slot, path: "/" })),
      ingress: {
        mode: environment.role === "production" ? "configured" : "direct",
        publicUrl: null,
      },
    },
  };
}

/** The slot's container port, or its default when the slot has none yet. */
export function slotContainerPort(config: HostAssignmentConfig, slot: HostSlot): number {
  return (
    config.ports.find((port) => port.slot === slot)?.containerPort ??
    defaultContainerPort(slot)
  );
}

/** The slot's health path as typed ("" when cleared), or "/" when the slot has none yet. */
export function slotHealthPath(config: HostAssignmentConfig, slot: HostSlot): string {
  const health = config.health.find((item) => item.slot === slot);
  return health ? (health.path ?? "") : "/";
}

/** The config with one slot's container port changed; the other slots keep theirs. */
export function withSlotContainerPort(
  config: HostAssignmentConfig,
  slot: HostSlot,
  containerPort: number,
): HostAssignmentConfig {
  const ports = config.ports.some((port) => port.slot === slot)
    ? config.ports.map((port) => (port.slot === slot ? { slot, containerPort } : port))
    : [...config.ports, { slot, containerPort }];
  return { ...config, ports };
}

/** The config with one slot's health path changed; an empty path is sent as null. */
export function withSlotHealthPath(
  config: HostAssignmentConfig,
  slot: HostSlot,
  path: string,
): HostAssignmentConfig {
  const next = { slot, path: path || null };
  const health = config.health.some((item) => item.slot === slot)
    ? config.health.map((item) => (item.slot === slot ? next : item))
    : [...config.health, next];
  return { ...config, health };
}

/**
 * The environments with each host assignment covering exactly `slots`, in
 * that order. A slot the assignment already has keeps its port and health
 * path, a missing slot gets the defaults, and a slot the project no longer
 * deploys is dropped. So a machine picked before the repository shape changed
 * (one application to two repositories, or back) still makes a request the
 * backend accepts.
 */
export function fitHostAssignments(
  environments: readonly EnvironmentDraft[],
  slots: readonly HostSlot[],
): EnvironmentDraft[] {
  return environments.map((environment) => {
    const binding = environment.hostAssignment;
    if (!binding) return environment;
    const config = binding.config;
    return {
      ...environment,
      hostAssignment: {
        ...binding,
        config: {
          ...config,
          ports: slots.map((slot) => ({ slot, containerPort: slotContainerPort(config, slot) })),
          health: slots.map((slot) => ({
            slot,
            path: config.health.find((item) => item.slot === slot)?.path ?? "/",
          })),
        },
      },
    };
  });
}
