import type { EnvironmentDraft } from "./project-environments-rules";

/**
 * The problem with each environment's on-prem host assignment, in the order
 * of `environments`: null where it is fine or has no machine. Host ports are
 * reserved in that order, so the later environment on a shared machine is the
 * one named.
 */
export function setupHostAssignmentProblems(
  environments: readonly EnvironmentDraft[],
): (string | null)[] {
  const reserved = new Set<string>();
  return environments.map((environment) =>
    assignmentProblem(environment, reserved),
  );
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

function assignmentProblem(
  environment: EnvironmentDraft,
  reserved: Set<string>,
): string | null {
  const binding = environment.hostAssignment;
  if (!binding) return null;
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
  return productionIngressProblem(environment);
}

function productionIngressProblem(environment: EnvironmentDraft) {
  return environment.role === "production" &&
    environment.hostAssignment &&
    !environment.hostAssignment.config.ingress.publicUrl?.startsWith("https://")
    ? "Add an HTTPS URL for Production, or choose Assign later."
    : null;
}
