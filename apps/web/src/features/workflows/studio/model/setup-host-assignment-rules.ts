import type { EnvironmentDraft } from "./project-environments-rules";

export function setupHostAssignmentsProblem(
  environments: readonly EnvironmentDraft[],
): string | null {
  const reserved = new Set<string>();
  for (const environment of environments) {
    const binding = environment.hostAssignment;
    if (!binding) continue;
    if (environment.runsOn !== "onprem")
      return "Assign machines only to on-prem environments.";
    for (const port of binding.config.ports) {
      if (
        ![port.hostPort, port.containerPort].every(
          (value) => Number.isInteger(value) && value > 0 && value <= 65535,
        )
      )
        return "Use whole port numbers from 1 to 65535.";
      const key = `${binding.machineId}:${port.hostPort}`;
      if (reserved.has(key))
        return "Use different host ports for environments sharing a machine.";
      reserved.add(key);
    }
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
