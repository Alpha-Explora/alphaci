/**
 * How much of a pipeline run the Runs tab opens up front, by role
 * (PERSONA_WORKFLOW_SPEC.md §3, "CI Stage Stepper & Tool Logs").
 *
 *   - `deep`: the developer who broke the build reads the tool logs, so each
 *     stage's failure output is shown as it always was.
 *   - `summary`: everyone else needs the verdict (stepper, pass/fail figures)
 *     more than the console; the logs sit behind a "Show logs" disclosure.
 *
 * This is presentation, not a security gate: the logs stay one click away and
 * the backend serves them to every role that can open the project.
 */

import type { AppRole } from "@/shared/api/contracts";

export type RunsViewMode = "deep" | "summary";

/**
 * An allow-list: only `member` gets the deep view. A role added later, or a
 * session whose role has not loaded, gets the summary until it is named here.
 */
const DEEP_DEBUG_ROLES: ReadonlySet<AppRole> = new Set(["member"]);

export function runsViewModeFor(role: AppRole | null | undefined): RunsViewMode {
  return role != null && DEEP_DEBUG_ROLES.has(role) ? "deep" : "summary";
}
