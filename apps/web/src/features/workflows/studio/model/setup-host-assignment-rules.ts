import type { EnvironmentDraft } from "./project-environments-rules";

export function setupHostAssignmentsProblem(
  environments: readonly EnvironmentDraft[],
): string | null {
  for (const environment of environments) {
    const binding = environment.hostAssignment;
    if (!binding) continue;
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
    const ingressProblem = productionIngressProblem(environment);
    if (ingressProblem) return ingressProblem;
  }
  return null;
}
function productionIngressProblem(environment: EnvironmentDraft) {
  return environment.role === "production" &&
    environment.hostAssignment &&
    !environment.hostAssignment.config.ingress.publicUrl?.startsWith("https://")
    ? "Production needs a configured HTTPS ingress URL, or choose Assign later."
    : null;
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
