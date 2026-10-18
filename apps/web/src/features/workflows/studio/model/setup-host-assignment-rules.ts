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

/** A new assignment with defaults; no machine means the only connected one. */
export function defaultHostAssignment(
  environment: EnvironmentDraft,
  slot: "frontend" | "backend",
  machineId?: string,
): NonNullable<EnvironmentDraft["hostAssignment"]> {
  return {
    ...(machineId ? { machineId } : {}),
    requestId: crypto.randomUUID(),
    config: {
      ports: [{ slot, containerPort: slot === "frontend" ? 3000 : 4000 }],
      health: [{ slot, path: "/" }],
      ingress: {
        mode: environment.role === "production" ? "configured" : "direct",
        publicUrl: null,
      },
    },
  };
}
