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
  // AlphaCI provides the automatic HTTPS address, so the mode itself meets the
  // requirement (a permanent apps-domain address, or the machine's tunnel).
  const { mode, publicUrl } = binding.config.ingress;
  if (mode === "tunnel") return null;
  if (mode === "configured" && publicUrl?.startsWith("https://")) return null;
  return "Add an HTTPS URL or choose the automatic HTTPS address for Production, or choose Assign later.";
}

/** A slot an on-prem host runs: the backend or the frontend container. */
export type HostSlot = "frontend" | "backend";

type HostAssignment = NonNullable<EnvironmentDraft["hostAssignment"]>;
type HostAssignmentConfig = HostAssignment["config"];

/** The container port and health path a slot's app serves. */
export interface SlotRuntime {
  containerPort: number;
  healthPath: string;
}

/**
 * Each slot's app as the backend's catalog describes it: the scaffold's
 * `serviceRuntime` for the project type that fills the slot. A slot is absent
 * when its type has no scaffold contract.
 */
export type SlotRuntimes = Partial<Record<HostSlot, SlotRuntime>>;

/**
 * What a slot starts with when the catalog has no contract for it (an older
 * backend, or a type with no scaffold). The same fallback the backend uses.
 */
function fallbackSlotRuntime(slot: HostSlot): SlotRuntime {
  return { containerPort: slot === "frontend" ? 3000 : 4000, healthPath: "/" };
}

/** The slot's defaults: its app's contract, or the fallback. */
export function slotRuntime(slot: HostSlot, runtimes?: SlotRuntimes): SlotRuntime {
  return runtimes?.[slot] ?? fallbackSlotRuntime(slot);
}

/**
 * A new assignment with defaults: one container port and one health path per
 * slot, because the backend wants exactly one of each for every slot the
 * environment deploys, taken from each slot's app. No machine means the only
 * connected one.
 */
export function defaultHostAssignment(
  environment: EnvironmentDraft,
  slots: readonly HostSlot[],
  machineId?: string,
  runtimes?: SlotRuntimes,
): HostAssignment {
  return {
    ...(machineId ? { machineId } : {}),
    requestId: crypto.randomUUID(),
    config: {
      ports: slots.map((slot) => ({
        slot,
        containerPort: slotRuntime(slot, runtimes).containerPort,
      })),
      health: slots.map((slot) => ({ slot, path: slotRuntime(slot, runtimes).healthPath })),
      // A frontend is what people open (QA Studio, reviewers), so it gets the
      // automatic HTTPS address; direct access only answers on the machine's
      // own network. Production gets it too: on a server with an apps domain
      // the backend makes it a permanent address. A backend alone elsewhere
      // stays direct.
      ingress: {
        mode:
          slots.includes("frontend") || environment.role === "production"
            ? "tunnel"
            : "direct",
        publicUrl: null,
      },
    },
  };
}

/** The slot's container port, or its default when the slot has none yet. */
export function slotContainerPort(
  config: HostAssignmentConfig,
  slot: HostSlot,
  runtimes?: SlotRuntimes,
): number {
  return (
    config.ports.find((port) => port.slot === slot)?.containerPort ??
    slotRuntime(slot, runtimes).containerPort
  );
}

/** The slot's health path as typed ("" when cleared), or its default when the slot has none yet. */
export function slotHealthPath(
  config: HostAssignmentConfig,
  slot: HostSlot,
  runtimes?: SlotRuntimes,
): string {
  const health = config.health.find((item) => item.slot === slot);
  return health ? (health.path ?? "") : slotRuntime(slot, runtimes).healthPath;
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
  runtimes?: SlotRuntimes,
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
          ports: slots.map((slot) => ({
            slot,
            containerPort: slotContainerPort(config, slot, runtimes),
          })),
          health: slots.map((slot) => ({
            slot,
            path:
              config.health.find((item) => item.slot === slot)?.path ??
              slotRuntime(slot, runtimes).healthPath,
          })),
        },
      },
    };
  });
}

/**
 * The environments after the project type behind a slot changed (say NestJS
 * to .NET): a port or health path still equal to the old type's default was
 * pre-filled, not chosen, so it takes the new type's default. One a person
 * changed stays. Returns `environments` itself when nothing changes.
 */
export function refitHostAssignmentDefaults(
  environments: readonly EnvironmentDraft[],
  previous: SlotRuntimes | undefined,
  next: SlotRuntimes | undefined,
): readonly EnvironmentDraft[] {
  let changed = false;
  const refitted = environments.map((environment) => {
    const binding = environment.hostAssignment;
    if (!binding) return environment;
    const ports = binding.config.ports.map((port) => {
      const from = slotRuntime(port.slot, previous).containerPort;
      const to = slotRuntime(port.slot, next).containerPort;
      return port.containerPort === from && from !== to
        ? { ...port, containerPort: to }
        : port;
    });
    const health = binding.config.health.map((item) => {
      const from = slotRuntime(item.slot, previous).healthPath;
      const to = slotRuntime(item.slot, next).healthPath;
      return item.path === from && from !== to ? { ...item, path: to } : item;
    });
    if (
      ports.every((port, index) => port === binding.config.ports[index]) &&
      health.every((item, index) => item === binding.config.health[index])
    )
      return environment;
    changed = true;
    return {
      ...environment,
      hostAssignment: { ...binding, config: { ...binding.config, ports, health } },
    };
  });
  return changed ? refitted : environments;
}
