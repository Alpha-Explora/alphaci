/* QA automation types — what CI reported for a QA run's exact branch and
 * commit. Pure: no React, no fetch.
 *
 * Two families live here:
 *
 *   Wire types (`Qa*Wire`) mirror the backend contract exactly. EVERY field may
 *   be absent: an older backend never sends them, and a report frozen before
 *   automation existed never had them. Nothing outside `qa-automation-rules`
 *   reads a wire type directly.
 *
 *   Normalised types are what views render. The normaliser turns every absent
 *   or malformed field into null (or a safe default), so a view can never hide
 *   or crash on a field the contract does not guarantee.
 *
 * Automated results are information for the tester. Sign-off stays manual:
 * nothing here ever changes an item's recorded status. */

export type QaAutomationStage = "verify" | "quality";

/** A CI stage run's own conclusion. */
export type QaStageRunStatus = "success" | "failure" | "running" | "cancelled";

/** Where the automated verdict for one item comes from. */
export type QaAutomatedSource = "playwright" | "unit_test" | "bruno";

/**
 * `unknown` — CI cannot tell for this item (still running, or more failures
 * than the report lists). `not_run` — no CI report for this commit yet.
 */
export type QaAutomatedStatus = "passed" | "failed" | "unknown" | "not_run";

/**
 * `spec` — the item's own spec file. `suite` — inferred from the whole suite.
 * `stage` — only the stage's overall verdict is known.
 */
export type QaAutomatedScope = "spec" | "suite" | "stage";

/* ── Wire (as the backend sends it; any field may be missing) ────────────── */

export interface QaTestFailureWire {
  name?: string;
  message?: string;
}

export interface QaStageTestsWire {
  total?: number;
  passed?: number;
  failed?: number;
  failures?: QaTestFailureWire[];
  failuresTruncated?: boolean;
}

export interface QaStageAutomationWire {
  stage?: QaAutomationStage;
  status?: QaStageRunStatus;
  runId?: number;
  runUrl?: string;
  reportedAt?: string;
  tests?: QaStageTestsWire | null;
}

export interface QaRunAutomationWire {
  verify?: QaStageAutomationWire | null;
  quality?: QaStageAutomationWire | null;
}

export interface QaAutomatedResultWire {
  source?: QaAutomatedSource;
  stage?: QaAutomationStage;
  status?: QaAutomatedStatus;
  scope?: QaAutomatedScope;
  matchedSpec?: string | null;
  failure?: QaTestFailureWire | null;
  runId?: number | null;
  runUrl?: string | null;
  reportedAt?: string | null;
}

/** 202 from POST …/automation/dispatch. */
export interface QaAutomationDispatchWire {
  workflowFile?: string;
  ref?: string;
  headSha?: string;
  /** False when the branch has moved past the run's commit since it started. */
  targetsRunCommit?: boolean;
}

/* ── Normalised (what views render) ──────────────────────────────────────── */

export interface QaTestFailure {
  name: string;
  /** Empty when CI sent no message. */
  message: string;
}

export interface QaStageTests {
  total: number | null;
  passed: number | null;
  failed: number | null;
  failures: QaTestFailure[];
  failuresTruncated: boolean;
}

export interface QaStageResult {
  /** From the key it was read under, so it is never missing. */
  stage: QaAutomationStage;
  status: QaStageRunStatus | null;
  runId: number | null;
  /** Only ever an http(s) URL. */
  runUrl: string | null;
  reportedAt: string | null;
  tests: QaStageTests | null;
}

export interface QaRunAutomationResult {
  verify: QaStageResult | null;
  quality: QaStageResult | null;
}

export interface QaAutomatedItemResult {
  source: QaAutomatedSource | null;
  stage: QaAutomationStage | null;
  /** `unknown` when CI sent no status it recognises. */
  status: QaAutomatedStatus;
  scope: QaAutomatedScope | null;
  matchedSpec: string | null;
  failure: QaTestFailure | null;
  runId: number | null;
  runUrl: string | null;
  reportedAt: string | null;
}

export interface QaAutomationDispatch {
  workflowFile: string | null;
  /** The branch or ref the workflow was started on. */
  ref: string | null;
  headSha: string | null;
  targetsRunCommit: boolean | null;
}
