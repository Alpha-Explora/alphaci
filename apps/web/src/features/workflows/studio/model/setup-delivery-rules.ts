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
import { runEveryEnvironmentOnprem } from "./onprem-hosting-rules";
import type { EnvironmentDraft } from "./project-environments-rules";
import { setupHostAssignmentProblems } from "./setup-host-assignment-rules";
import { isProjectQuotaReached } from "./setup-tab-rules";
import { formatQuotaStatus } from "./workflow-studio-rules";

export const TEAM_CHOICE_MISSING_MESSAGE =
  "Choose the team this project belongs to.";

/**
 * Each environment's on-prem host problem, in promotion order, or null. Only
 * on-prem hosting sends its environments, and only while the machine rows are
 * on screen to fix them: with no healthy machine the rows are hidden, so
 * nothing here may hold Continue. Checked as the create request sends the
 * environments, every one on-prem, whatever "Runs on" the form holds.
 */
export function deliveryHostProblems(input: {
  choice: HostingChoice;
  environments: readonly EnvironmentDraft[];
  /** Whether the machine rows are on screen (at least one healthy machine). */
  machineRowsShown: boolean;
}): (string | null)[] {
  if (input.choice !== "onprem" || !input.machineRowsShown) {
    return input.environments.map(() => null);
  }
  return setupHostAssignmentProblems(
    runEveryEnvironmentOnprem(input.environments),
  );
}

/** The first of a list of host problems, or null. */
export function firstHostProblem(
  problems: readonly (string | null)[],
): string | null {
  return problems.find((problem) => problem !== null) ?? null;
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
  teamChoiceMissing: boolean;
  hostProblem: string | null;
  renderVariablesMissing: boolean;
  /** The Project the repository joins has no Feature yet, or null. */
  projectBlocker: string | null;
  projectQuota: UsageLimitItem | null;
}): string | null {
  if (input.teamChoiceMissing) return TEAM_CHOICE_MISSING_MESSAGE;
  if (input.hostProblem) return input.hostProblem;
  if (input.renderVariablesMissing) return RENDER_VARIABLES_MISSING_MESSAGE;
  if (input.projectBlocker) return input.projectBlocker;
  const quota = input.projectQuota;
  if (quota && isProjectQuotaReached(quota)) {
    return "Project quota: " + formatQuotaStatus(quota);
  }
  return null;
}
