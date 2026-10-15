/* PO Studio: a Product owner's acceptance of the whole system on uat, and
 * the merge to main that follows. Pure: no React, no fetch, no Next.
 *
 * The gate is the server's: only `eligible: true` on the promotion status (the
 * Project's latest run signed off Approved on every repository's current uat
 * head) unlocks it. These rules only say what the panel shows meanwhile. */

import type { ProjectQaRun } from "./project-run-types";
import type { QaPromotionStatus } from "./qa-promotion-types";
import type { QaScope } from "./qa-scope";

export type PoAcceptanceState =
  /** The repository's Project or the promotion status is still being read. */
  | "loading"
  /** Not filed under a Project: nothing to accept, and main is closed to it. */
  | "unfiled"
  /** QA has not signed the current uat heads off as Approved yet. */
  | "waiting"
  /** Signed off Approved on every repository's current head: ready for main. */
  | "ready"
  /** The Project's iteration reached main: nothing left to accept or merge. */
  | "delivered";

export function poAcceptanceState(input: {
  scope: QaScope;
  promotionStatus: "loading" | "ready" | "error" | "unavailable";
  promotion: QaPromotionStatus | null;
}): PoAcceptanceState {
  const { scope, promotionStatus, promotion } = input;
  if (scope.kind === "pending" || promotionStatus === "loading") return "loading";
  if (scope.kind === "repository" || promotion?.scope === "unfiled") return "unfiled";
  if (promotion?.iterationDelivered === true) return "delivered";
  return promotion?.eligible === true ? "ready" : "waiting";
}

export const PO_WAITING_TITLE = "Waiting for QA sign-off";
export const PO_READY_TITLE = "Ready for production";
export const PO_READY_TEXT =
  "The QA Team verified every requirement on uat and signed it off as Approved. Accept it here and merge it to main.";

const UNLOCK =
  "PO Studio unlocks once the QA Team verifies every requirement on uat and signs the Project off as Approved.";

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/**
 * Why the release candidate is still locked, in terms of the QA run: not
 * started, how far it got, signed off with another verdict, or overtaken by
 * a new uat head.
 */
export function poWaitingText(run: Pick<ProjectQaRun, "status" | "summary" | "signoff" | "stale"> | null): string {
  if (!run) return `The QA Team has not started QA testing for this Project yet. ${UNLOCK}`;
  if (run.stale) return `uat moved since this run started, so the QA Team verifies the current heads again. ${UNLOCK}`;
  if (run.status === "signed_off" && run.signoff && run.signoff.verdict !== "APPROVED") {
    const verdict = run.signoff.verdict === "REJECTED" ? "Rejected" : "Conditional";
    return `QA signed this run off as ${verdict}. Only an Approved sign-off on the current uat heads unlocks the merge.`;
  }
  const passed = run.summary.byStatus.passed;
  const left = run.summary.total - passed;
  return `${String(passed)} of ${plural(run.summary.total, "item", "items")} passed, ${String(left)} still with QA. ${UNLOCK}`;
}
