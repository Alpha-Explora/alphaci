/**
 * What holds the Delivery step, and the reason Create is blocked, as the
 * Review step shows it.
 *
 * Pure functions only. The on-prem host assignments are checked on the
 * Delivery step, where they are fixed, so the user never reaches Create with a
 * machine the create request would refuse.
 */
import type { UsageLimitItem } from "@/shared/api/contracts";
import { RENDER_VARIABLES_MISSING_MESSAGE } from "./create-target-rules";
import type { HostingChoice } from "./hosting-choice-rules";
import type { EnvironmentDraft } from "./project-environments-rules";
import { runEveryEnvironmentOnprem } from "./onprem-hosting-rules";
import { setupHostAssignmentProblems } from "./setup-host-assignment-rules";
import { isProjectQuotaReached } from "./setup-tab-rules";
import { formatQuotaStatus } from "./workflow-studio-rules";

/**
 * Each environment's on-prem host problem, in promotion order, or null where
 * it is fine. Checked as the create request sends the environments: under
 * on-prem hosting every one runs on-prem, whatever "Runs on" the form holds.
 */
export function onpremHostProblems(
  environments: readonly EnvironmentDraft[],
): (string | null)[] {
  return setupHostAssignmentProblems(runEveryEnvironmentOnprem(environments));
}

/**
 * The on-prem host problem the Delivery step shows, or null. Only on-prem
 * hosting sends its environments, so a machine left on an environment after
 * the user switched hosting is not checked: nothing on screen could fix it.
 */
export function deliveryHostProblem(input: {
  choice: HostingChoice;
  environments: readonly EnvironmentDraft[];
}): string | null {
  if (input.choice !== "onprem") return null;
  return onpremHostProblems(input.environments).find((problem) => problem !== null) ?? null;
}

/** The Delivery step can be left (Continue) only when this holds. */
export function isDeliveryStepReady(input: {
  renderVariablesMissing: boolean;
  hostProblem: string | null;
}): boolean {
  return !input.renderVariablesMissing && input.hostProblem === null;
}

/**
 * Why Create cannot be sent yet, shown above the Review step's button, or null
 * when it can. The first reason wins. Each one also holds Create disabled, so
 * the text never sits beside an enabled button.
 */
export function createBlockerReason(input: {
  hostProblem: string | null;
  renderVariablesMissing: boolean;
  /** The Project the repository joins has no Feature yet, or null. */
  projectBlocker: string | null;
  projectQuota: UsageLimitItem | null;
}): string | null {
  if (input.hostProblem) return input.hostProblem;
  if (input.renderVariablesMissing) return RENDER_VARIABLES_MISSING_MESSAGE;
  if (input.projectBlocker) return input.projectBlocker;
  const quota = input.projectQuota;
  if (quota && isProjectQuotaReached(quota)) {
    return "Project quota: " + formatQuotaStatus(quota);
  }
  return null;
}
