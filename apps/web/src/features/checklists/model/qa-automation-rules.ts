/* Pure QA automation rules: normalising what CI reported, labels, the
 * one-sentence description of an item's automated result, and the copy for
 * starting Playwright. No React, no fetch.
 *
 * The lesson this module encodes: a feature that renders only when a response
 * field is present disappears the day a backend (or a report frozen last
 * month) does not send it. So every read of automation data goes through a
 * normaliser that accepts ANY input — undefined, null, a partial object, the
 * wrong types — and returns a shape whose missing parts are null. Visibility
 * is decided by what the contract guarantees (the run exists), never by an
 * optional field.
 *
 * Automated results inform the tester; they never change or recommend
 * changing an item's recorded status. Sign-off stays manual. */

import { casesFromPasses, normalizeTestCases } from "@/features/runs/test-report";
import type { TestCase } from "@/shared/api/contracts";
import { stripAnsi } from "@/shared/ui/strip-ansi";

import type { AppRole } from "@/shared/api/contracts";

import type {
  QaAutomatedItemResult,
  QaAutomatedScope,
  QaAutomatedSource,
  QaAutomatedStatus,
  QaAutomationDispatch,
  QaAutomationStage,
  QaRunAutomationResult,
  QaStageResult,
  QaStageRunStatus,
  QaStageTests,
  QaTestFailure,
} from "./qa-automation-types";
import { commitLabel, roleCanStartRun, shortSha, type QaTone } from "./qa-run-rules";
import type { QaRun, QaRunItemStatus } from "./qa-run-types";

/* ── Reading untrusted input ─────────────────────────────────────────────── */

type Loose = Record<string, unknown>;

function record(value: unknown): Loose | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Loose) : null;
}

function oneOf<T extends string>(value: unknown, allowed: ReadonlyArray<T>): T | null {
  return typeof value === "string" && (allowed as ReadonlyArray<string>).includes(value) ? (value as T) : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** A whole, non-negative count; anything else is "not known". */
function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
}

function runNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Only an absolute http(s) URL is ever rendered as a link. */
function httpUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate || !/^https?:\/\//i.test(candidate)) return null;
  try {
    return new URL(candidate).toString();
  } catch {
    return null;
  }
}

/** Non-empty ISO-ish date text that actually parses. */
function isoDate(value: unknown): string | null {
  const candidate = text(value);
  return candidate && !Number.isNaN(Date.parse(candidate)) ? candidate : null;
}

const STAGES: ReadonlyArray<QaAutomationStage> = ["verify", "quality"];
const STAGE_RUN_STATUSES: ReadonlyArray<QaStageRunStatus> = ["success", "failure", "running", "cancelled"];
const SOURCES: ReadonlyArray<QaAutomatedSource> = ["playwright", "unit_test", "bruno"];
const AUTOMATED_STATUSES: ReadonlyArray<QaAutomatedStatus> = ["passed", "failed", "unknown", "not_run", "unlinked"];
const SCOPES: ReadonlyArray<QaAutomatedScope> = ["spec", "suite", "stage"];

/* ── Normalising ─────────────────────────────────────────────────────────── */

/** A failure needs at least a name to be worth listing. */
export function normalizeFailure(raw: unknown): QaTestFailure | null {
  const value = record(raw);
  const name = plainText(value?.name);
  if (!value || !name) return null;
  return { name, message: plainText(value.message) ?? "" };
}

function normalizeFailures(raw: unknown): QaTestFailure[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeFailure).filter((failure): failure is QaTestFailure => failure !== null);
}

function normalizeTests(raw: unknown): QaStageTests | null {
  const value = record(raw);
  if (!value) return null;
  return {
    total: count(value.total),
    passed: count(value.passed),
    failed: count(value.failed),
    failures: normalizeFailures(value.failures),
    failuresTruncated: value.failuresTruncated === true,
    passes: Array.isArray(value.passes) ? value.passes.filter((name): name is string => typeof name === "string") : null,
    cases: normalizeTestCases(value.cases),
  };
}

/**
 * The tests to list for a stage: the pipeline's own records when it sends
 * them; otherwise, from a pipeline that reports only names, the failures
 * (with their message) and then the passing names. Null when neither exists,
 * so the stage keeps its plain failure list.
 */
export function stageTestCases(tests: QaStageTests | null): TestCase[] | null {
  if (!tests) return null;
  if (tests.cases && tests.cases.length > 0) return tests.cases;
  if (!tests.passes) return null;
  const failed: TestCase[] = tests.failures.map((failure) => ({
    title: failure.name,
    status: "failed",
    error: failure.message ? { message: failure.message } : undefined,
  }));
  return [...failed, ...casesFromPasses(tests.passes)];
}

/** Plain text: trimmed, terminal colour codes removed; null when nothing is left. */
function plainText(value: unknown): string | null {
  return typeof value === "string" ? text(stripAnsi(value)) : null;
}

function messageText(message: Loose): string | null {
  return plainText(message.title) ?? plainText(message.detail);
}

/** The first error among the stage's friendly messages, else the first message. */
function leadMessageText(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  const messages = raw.map(record).filter((message): message is Loose => message !== null);
  const lead = messages.find((message) => message.severity === "error") ?? messages[0];
  return lead ? messageText(lead) : null;
}

/** Why a stage ended as it did, when the server said: its messages, else a plain reason. */
function stageReasonOf(value: Loose): string | null {
  return leadMessageText(value.friendlyMessages) ?? plainText(value.reason);
}

function normalizeStage(raw: unknown, stage: QaAutomationStage): QaStageResult | null {
  const value = record(raw);
  if (!value) return null;
  const reason = stageReasonOf(value);
  return {
    stage,
    status: oneOf(value.status, STAGE_RUN_STATUSES),
    runId: runNumber(value.runId),
    runUrl: httpUrl(value.runUrl),
    reportedAt: isoDate(value.reportedAt),
    tests: normalizeTests(value.tests),
    ...(reason ? { reason } : {}),
  };
}

/**
 * The line where a stage's counts go when it sent none. A failed stage that
 * said why shows its reason ("Quality gate failed: coverage 61% < 80%");
 * anything else keeps "No test counts reported".
 */
export function stageNoCountsLine(result: Pick<QaStageResult, "status" | "reason">): {
  text: string;
  isReason: boolean;
} {
  if (result.status === "failure" && result.reason) return { text: result.reason, isReason: true };
  return { text: "No test counts reported", isReason: false };
}

/**
 * The line for a stage that has not reported. Verify runs after Quality, so
 * when Quality failed on the same commit that is why Verify has nothing:
 * "Not run: Quality failed on a1b2c3d first". Otherwise, as before, "Not
 * reported for a1b2c3d yet".
 */
export function stageMissingLine(
  stage: QaAutomationStage,
  commitSha: string | null,
  upstream: QaStageResult | null,
): string {
  const short = shortSha(commitSha);
  const on = short ? ` on ${short}` : "";
  if (stage === "verify" && upstream?.status === "failure") {
    const why = upstream.reason ? ` (${upstream.reason})` : "";
    return `Not run: ${stageName("quality")} failed${on} first${why}`;
  }
  return short ? `Not reported for ${short} yet` : "Not reported yet";
}

/**
 * A run's (or a report's) automation, whatever arrived: undefined from an
 * older backend, null, a partial object. Always returns both keys.
 */
export function normalizeRunAutomation(raw: unknown): QaRunAutomationResult {
  const value = record(raw);
  return {
    verify: normalizeStage(value?.verify, "verify"),
    quality: normalizeStage(value?.quality, "quality"),
  };
}

/** Whether any stage reported at all. */
export function hasStageResults(automation: QaRunAutomationResult): boolean {
  return automation.verify !== null || automation.quality !== null;
}

/** The stages in display order, reported or not. */
export function automationStages(
  automation: QaRunAutomationResult,
): Array<{ stage: QaAutomationStage; result: QaStageResult | null }> {
  return STAGES.map((stage) => ({ stage, result: automation[stage] }));
}

export function stageResultFor(
  automation: QaRunAutomationResult,
  stage: QaAutomationStage | null,
): QaStageResult | null {
  return stage ? automation[stage] : null;
}

/**
 * One item's automated result. Null for a manual item, and for anything that
 * is not an object. An object with no recognisable status reads as `unknown`
 * rather than disappearing: CI said something about this item.
 */
export function normalizeAutomatedResult(raw: unknown): QaAutomatedItemResult | null {
  const value = record(raw);
  if (!value) return null;
  return {
    source: oneOf(value.source, SOURCES),
    stage: oneOf(value.stage, STAGES),
    status: oneOf(value.status, AUTOMATED_STATUSES) ?? "unknown",
    scope: oneOf(value.scope, SCOPES),
    matchedSpec: text(value.matchedSpec),
    failure: normalizeFailure(value.failure),
    runId: runNumber(value.runId),
    runUrl: httpUrl(value.runUrl),
    reportedAt: isoDate(value.reportedAt),
    inferred: value.inferred === true,
  };
}

export function normalizeDispatch(raw: unknown): QaAutomationDispatch {
  const value = record(raw);
  return {
    workflowFile: text(value?.workflowFile),
    ref: text(value?.ref),
    headSha: text(value?.headSha),
    targetsRunCommit: typeof value?.targetsRunCommit === "boolean" ? value.targetsRunCommit : null,
  };
}

/* ── Labels ──────────────────────────────────────────────────────────────── */

const AUTOMATED_STATUS_LABELS: Record<QaAutomatedStatus, string> = {
  passed: "Passed",
  failed: "Failed",
  unknown: "Unknown",
  not_run: "Not run",
  unlinked: "Not linked",
};

const AUTOMATED_STATUS_TONES: Record<QaAutomatedStatus, QaTone> = {
  passed: "success",
  failed: "danger",
  unknown: "neutral",
  not_run: "neutral",
  unlinked: "neutral",
};

const SCOPE_LABELS: Record<QaAutomatedScope, string> = {
  spec: "This spec",
  suite: "Whole suite",
  stage: "Stage result",
};

const SOURCE_LABELS: Record<QaAutomatedSource, string> = {
  playwright: "Playwright E2E",
  unit_test: "Unit test",
  bruno: "Bruno API",
};

const STAGE_NAMES: Record<QaAutomationStage, string> = { verify: "Verify", quality: "Quality" };

const STAGE_COVERAGE: Record<QaAutomationStage, string> = {
  verify: "browser & API tests",
  quality: "unit tests",
};

const STAGE_RUN_LABELS: Record<QaStageRunStatus, string> = {
  success: "Passed",
  failure: "Failed",
  running: "Running",
  cancelled: "Cancelled",
};

const STAGE_RUN_TONES: Record<QaStageRunStatus, QaTone> = {
  success: "success",
  failure: "danger",
  running: "brand",
  cancelled: "neutral",
};

export function automatedStatusLabel(status: QaAutomatedStatus): string {
  return AUTOMATED_STATUS_LABELS[status] ?? "Unknown";
}

/**
 * A pass CI did not confirm: an older pipeline reports only failures, so the
 * backend inferred this one from the test's absence in that list. Only a pass
 * can be unconfirmed — an inferred flag on anything else is ignored.
 */
export function isUnconfirmedPass(result: Pick<QaAutomatedItemResult, "status" | "inferred">): boolean {
  return result.status === "passed" && result.inferred;
}

export const UNCONFIRMED_PASS_LABEL = "Passed (not confirmed)";

export const UNCONFIRMED_PASS_HINT =
  "Older pipeline: this test wasn't in the failure list, but its pass wasn't reported. Update the pipeline to confirm passes.";

/** The badge's word: "Passed", or "Passed (not confirmed)" for an inferred pass. */
export function automatedBadgeLabel(status: QaAutomatedStatus, inferred = false): string {
  return isUnconfirmedPass({ status, inferred }) ? UNCONFIRMED_PASS_LABEL : automatedStatusLabel(status);
}

export function automatedStatusTone(status: QaAutomatedStatus): QaTone {
  return AUTOMATED_STATUS_TONES[status] ?? "neutral";
}

/** "This spec" / "Whole suite" / "Stage result"; null when CI gave no scope. */
export function automatedScopeLabel(scope: QaAutomatedScope | null): string | null {
  return scope ? SCOPE_LABELS[scope] ?? null : null;
}

/**
 * The scope beside an item's badge. Null for an unlinked item: "Stage result"
 * there would read as though the stage's verdict were the item's.
 */
export function itemScopeLabel(result: Pick<QaAutomatedItemResult, "status" | "scope">): string | null {
  return result.status === "unlinked" ? null : automatedScopeLabel(result.scope);
}

export function automatedSourceLabel(source: QaAutomatedSource | null): string {
  return source ? SOURCE_LABELS[source] ?? "Automated test" : "Automated test";
}

/** "Verify" / "Quality". */
export function stageName(stage: QaAutomationStage): string {
  return STAGE_NAMES[stage] ?? stage;
}

/** What a stage runs: "browser & API tests" / "unit tests". */
export function stageCoverage(stage: QaAutomationStage): string {
  return STAGE_COVERAGE[stage] ?? "tests";
}

/** "Verify — browser & API tests". */
export function stageTitle(stage: QaAutomationStage): string {
  return `${stageName(stage)} — ${stageCoverage(stage)}`;
}

export function stageRunLabel(status: QaStageRunStatus | null): string {
  return status ? STAGE_RUN_LABELS[status] ?? "Unknown" : "Unknown";
}

export function stageRunTone(status: QaStageRunStatus | null): QaTone {
  return status ? STAGE_RUN_TONES[status] ?? "neutral" : "neutral";
}

/* ── The one-sentence description ────────────────────────────────────────── */

export interface AutomatedSentenceContext {
  /** The run's commit, for "not run for a1b2c3d yet". */
  commitSha?: string | null;
  /** The stage this result came from, to say WHY a result is unknown. */
  stageResult?: QaStageResult | null;
}

function stageWord(stage: QaAutomationStage | null): string {
  return stage ?? "CI";
}

function verdictSentence(result: QaAutomatedItemResult, verb: "passed" | "failed"): string {
  if (result.scope === "spec") {
    return result.matchedSpec
      ? `Automated: ${verb} in ${result.matchedSpec}`
      : `Automated: ${verb} (this spec)`;
  }
  if (result.scope === "suite") {
    return verb === "passed"
      ? "Automated: passed (whole suite green)"
      : "Automated: failed (whole suite has failures)";
  }
  if (result.scope === "stage") return `Automated: ${stageWord(result.stage)} stage ${verb}`;
  return `Automated: ${verb}`;
}

function unknownSentence(result: QaAutomatedItemResult, stageResult: QaStageResult | null): string {
  if (stageResult?.status === "running") {
    return `Automated: unknown — ${stageWord(result.stage)} is still running`;
  }
  if (stageResult?.tests?.failuresTruncated) return "Automated: unknown — more failures than listed";
  return "Automated: unknown — CI could not tell for this item";
}

function notRunSentence(commitSha: string | null | undefined): string {
  const short = shortSha(commitSha);
  return short ? `Automated: not run for ${short} yet` : "Automated: not run for this commit yet";
}

/** The kind of test an unlinked item lacks: quality-stage items are unit tests. */
function unlinkedTestKind(result: Pick<QaAutomatedItemResult, "source" | "stage">): string {
  if (result.stage === "quality" || result.source === "unit_test") return "a unit test";
  return result.source === "bruno" ? "an API test" : "a Playwright test";
}

/**
 * "Not linked to a Playwright test. Check this by hand." — the item names no
 * test, so no CI result speaks for it, whatever its stage did.
 */
export function unlinkedSentence(result: Pick<QaAutomatedItemResult, "source" | "stage">): string {
  return `Not linked to ${unlinkedTestKind(result)}. Check this by hand.`;
}

const STAGE_CONTEXT_VERBS: Record<QaStageRunStatus, string> = {
  success: "passed",
  failure: "failed",
  running: "is still running",
  cancelled: "was cancelled",
};

/**
 * Secondary context for an unlinked item: "For context: the Verify stage
 * passed, but no test in it is linked to this item." Null for any other
 * status, and when the stage's verdict is not known.
 */
export function unlinkedStageNote(
  result: Pick<QaAutomatedItemResult, "status" | "stage">,
  stageResult: QaStageResult | null,
): string | null {
  if (result.status !== "unlinked" || !result.stage || !stageResult?.status) return null;
  const verb = STAGE_CONTEXT_VERBS[stageResult.status] ?? stageResult.status;
  return `For context: the ${stageName(result.stage)} stage ${verb}, but no test in it is linked to this item.`;
}

/**
 * What a report's checklist table prints under an item's badge: the unlinked
 * sentence, else the scope ("This spec"); null when CI gave no scope.
 */
export function automatedCellNote(result: QaAutomatedItemResult): string | null {
  return result.status === "unlinked" ? unlinkedSentence(result) : automatedScopeLabel(result.scope);
}

/**
 * "Automated: failed in e2e/checkout.spec.ts", "Automated: passed (whole suite
 * green)", "Automated: verify stage failed", "Automated: not run for a1b2c3d
 * yet", "Automated: unknown — more failures than listed". An inferred pass
 * says so: "Automated: passed in e2e/home.spec.ts (not confirmed)". An item
 * with no test: "Not linked to a Playwright test. Check this by hand."
 */
export function automatedSentence(
  result: QaAutomatedItemResult,
  context: AutomatedSentenceContext = {},
): string {
  if (result.status === "unlinked") return unlinkedSentence(result);
  if (isUnconfirmedPass(result)) return `${verdictSentence(result, "passed")} (not confirmed)`;
  if (result.status === "passed" || result.status === "failed") {
    return verdictSentence(result, result.status);
  }
  if (result.status === "not_run") return notRunSentence(context.commitSha);
  return unknownSentence(result, context.stageResult ?? null);
}

export const AUTOMATED_DIFFERS_HINT = "Automated result differs from the recorded status";

/**
 * True only when both sides are a verdict and they disagree: recorded Passed
 * with automated Failed, or the reverse. Informational — the recorded status
 * is the tester's and stays as they set it.
 */
export function automatedDiffers(recorded: QaRunItemStatus, automated: QaAutomatedStatus): boolean {
  return (
    (recorded === "passed" && automated === "failed") ||
    (recorded === "failed" && automated === "passed")
  );
}

/* ── Stage figures ───────────────────────────────────────────────────────── */

/** The most failures listed on screen or paper; the rest are counted. */
export const MAX_LISTED_FAILURES = 20;

/** "18 / 20 passed", or null when CI did not send both numbers. */
export function stageTestsLabel(tests: QaStageTests | null): string | null {
  if (!tests || tests.passed === null || tests.total === null) return null;
  return `${tests.passed} / ${tests.total} passed`;
}

/** Passed share of the total, 0..100, for the slim bar. Null when unknown. */
export function stagePassShare(tests: QaStageTests | null): number | null {
  if (!tests || tests.passed === null || !tests.total) return null;
  return Math.min(100, Math.max(0, (tests.passed / tests.total) * 100));
}

export function listedFailures(tests: QaStageTests | null): QaTestFailure[] {
  return tests ? tests.failures.slice(0, MAX_LISTED_FAILURES) : [];
}

function unlistedCount(tests: QaStageTests): number {
  const listed = Math.min(tests.failures.length, MAX_LISTED_FAILURES);
  return Math.max(tests.failures.length - listed, (tests.failed ?? 0) - listed, 0);
}

/**
 * "3 more failures not listed" when CI truncated the list (or sent more than
 * the page shows). Null when every failure is listed.
 */
export function unlistedFailuresNote(tests: QaStageTests | null): string | null {
  if (!tests) return null;
  const hidden = unlistedCount(tests);
  if (!tests.failuresTruncated && hidden === 0) return null;
  if (hidden === 0) return "More failures than listed — open the run for the full list.";
  return `${hidden} more ${hidden === 1 ? "failure" : "failures"} not listed.`;
}

/**
 * The stage's failures disclosure: "Show 2 failures", "Show 20 of 23
 * failures", "Hide …" once open. Null when nothing is listed.
 */
export function failuresToggleLabel(tests: QaStageTests | null, open: boolean): string | null {
  const listed = listedFailures(tests).length;
  if (listed === 0) return null;
  const verb = open ? "Hide" : "Show";
  const failed = tests?.failed ?? 0;
  if (failed > listed) return `${verb} ${listed} of ${failed} failures`;
  return `${verb} ${listed} ${listed === 1 ? "failure" : "failures"}`;
}

/** "No automated results for main @ a1b2c3d yet." */
export function noAutomationText(branch: string, commitSha: string | null | undefined): string {
  return `No automated results for ${commitLabel(branch, commitSha)} yet.`;
}

/* ── Starting Playwright ─────────────────────────────────────────────────── */

/** Every 20 s after a dispatch, for up to 10 minutes. */
export const AUTOMATION_POLL_INTERVAL_MS = 20_000;
export const AUTOMATION_POLL_WINDOW_MS = 10 * 60_000;

/** The people who start runs start Playwright on them. The server decides. */
export function roleCanDispatch(role: AppRole | null | undefined): boolean {
  return roleCanStartRun(role);
}

/**
 * Why the button is disabled on this run, or null when it is not. Said to
 * everyone offered the button, including viewers who cannot reopen the run.
 */
export function dispatchBlockedReason(run: Pick<QaRun, "status">): string | null {
  return run.status === "signed_off"
    ? "This run is signed off, so Playwright cannot run on it until it is reopened."
    : null;
}

/** The same, beside the "Reopen run" button a viewer who may reopen is offered. */
export const REOPEN_TO_RUN_PLAYWRIGHT = "This run is signed off. Reopen it to run Playwright.";

export function dispatchConfirmation(
  dispatch: QaAutomationDispatch,
  run: Pick<QaRun, "branch">,
): string {
  return `Playwright started on ${dispatch.ref ?? run.branch}. Results appear here when the run reports.`;
}

function sameCommit(a: string, b: string): boolean {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  return left.startsWith(right) || right.startsWith(left);
}

/** Whether the workflow will test a newer commit than the run's. */
function branchMoved(dispatch: QaAutomationDispatch, runSha: string | null): boolean {
  if (dispatch.targetsRunCommit !== null) return !dispatch.targetsRunCommit;
  // An older backend without the flag: compare the shas it did send.
  return Boolean(dispatch.headSha && runSha && !sameCommit(dispatch.headSha, runSha));
}

/**
 * "The branch has moved to 9f8e7d6 — results will attach to that commit, not
 * this run's a1b2c3d." Null when the workflow tests the run's own commit.
 */
export function dispatchMovedWarning(
  dispatch: QaAutomationDispatch,
  run: Pick<QaRun, "commitSha">,
): string | null {
  if (!branchMoved(dispatch, run.commitSha ?? null)) return null;
  const runSha = shortSha(run.commitSha);
  const head = shortSha(dispatch.headSha);
  if (!head) {
    return `The branch has moved since this run started — results will attach to the newer commit, not this run's ${runSha}.`;
  }
  return `The branch has moved to ${head} — results will attach to that commit, not this run's ${runSha}.`;
}

/**
 * Whether the verify stage has reported for this run since `sinceMs`, so
 * polling can stop early. A report still marked running does not count.
 */
export function verifySettledSince(automation: QaRunAutomationResult, sinceMs: number): boolean {
  const verify = automation.verify;
  if (!verify?.reportedAt || verify.status === "running") return false;
  return Date.parse(verify.reportedAt) >= sinceMs;
}

export interface QaDispatchError {
  message: string;
  /** True when signing in again is the fix: show a sign-in link. */
  signIn: boolean;
  /** One "repo — reason" line per repository GitHub refused, when the server listed them. */
  failures: string[];
}

function errorStatus(cause: unknown): number | null {
  const status = record(cause)?.status;
  return typeof status === "number" ? status : null;
}

function errorDetails(cause: unknown): Loose | null {
  return record(record(cause)?.details);
}

function errorCode(cause: unknown): string {
  const details = errorDetails(cause);
  const code = details?.code ?? record(details?.error)?.code;
  return typeof code === "string" ? code.toUpperCase() : "";
}

const MAX_SERVER_MESSAGE = 240;
/** The framework's stock reason phrases say nothing the status does not. */
const GENERIC_HTTP_TEXT: ReadonlySet<string> = new Set([
  "forbidden",
  "forbidden resource",
  "unauthorized",
  "conflict",
  "bad request",
  "unprocessable entity",
]);
const MAX_FAILURE_LINES = 20;
const REFUSED_FALLBACK = "GitHub refused to start Playwright.";

/**
 * A server sentence that is safe to show: one short line of plain text.
 * Anything that looks like markup (a proxy's HTML error page) is dropped, so
 * the caller falls back to its own copy instead of showing raw HTML.
 */
function plainMessage(raw: string | null): string | null {
  if (!raw || /<\s*\/?\s*[a-z!]/i.test(raw)) return null;
  const line = raw.replace(/\s+/g, " ").trim();
  if (!line || GENERIC_HTTP_TEXT.has(line.toLowerCase())) return null;
  return line.length > MAX_SERVER_MESSAGE ? `${line.slice(0, MAX_SERVER_MESSAGE - 1)}…` : line;
}

function errorMessage(cause: unknown): string | null {
  const message = errorDetails(cause)?.message;
  if (Array.isArray(message)) return plainMessage(text(message.filter((part) => typeof part === "string").join(" ")));
  return plainMessage(text(message));
}

/** "logistics2cicd-fe — GitHub refused: no write access" */
export function dispatchFailureLine(repoFullName: string | null | undefined, message: string | null | undefined): string {
  const reason = plainMessage(text(message)) ?? REFUSED_FALLBACK;
  const name = text(repoFullName)?.split("/").pop();
  return name ? `${name} — ${reason}` : reason;
}

function failureLines(cause: unknown): string[] {
  const failed = errorDetails(cause)?.failed;
  if (!Array.isArray(failed)) return [];
  return failed
    .map(record)
    .filter((entry): entry is Loose => entry !== null)
    .slice(0, MAX_FAILURE_LINES)
    .map((entry) => dispatchFailureLine(text(entry.repoFullName), text(entry.message)));
}

const CODE_ERRORS: Record<string, Omit<QaDispatchError, "failures">> = {
  GITHUB_REAUTH: {
    message: "GitHub needs you to sign in again before ALPHACI can start Playwright for you.",
    signIn: true,
  },
  VERIFY_WORKFLOW_MISSING: {
    message:
      "This repository has no verify workflow for ALPHACI to start. Add the verify stage to the project's workflow, then try again.",
    signIn: false,
  },
};

const STATUS_ERRORS: Record<number, string> = {
  401: "Your session has ended. Sign in again to start Playwright.",
  404: "This QA run no longer exists, or you no longer have access to it.",
};

const SIGNED_OFF_ERROR = "This run is signed off, so Playwright cannot be started on it. Reopen it first.";
const DISPATCH_FALLBACK = "Playwright could not be started. Try again in a moment.";

/** Statuses where the server's own sentence is the explanation worth showing. */
function usesServerMessage(status: number | null): boolean {
  return status === 400 || status === 403 || status === 409 || status === 422;
}

function dispatchMessage(status: number | null, cause: unknown): string {
  if (status !== null && STATUS_ERRORS[status]) return STATUS_ERRORS[status];
  if (usesServerMessage(status)) {
    const fallback = status === 409 ? SIGNED_OFF_ERROR : status === 403 ? REFUSED_FALLBACK : DISPATCH_FALLBACK;
    return errorMessage(cause) ?? fallback;
  }
  return DISPATCH_FALLBACK;
}

/** A failed dispatch as something to show, and whether to offer sign-in. */
export function dispatchError(cause: unknown): QaDispatchError {
  const failures = failureLines(cause);
  const known = CODE_ERRORS[errorCode(cause)];
  if (known) return { ...known, failures };
  const status = errorStatus(cause);
  return { message: dispatchMessage(status, cause), signIn: status === 401, failures };
}

/**
 * Where "Sign in again" goes: login, then straight back to this project —
 * the same `next` shape the project page's own sign-in links use.
 */
export function qaSignInHref(projectId: string): string {
  return `/login?next=/projects/${encodeURIComponent(projectId)}`;
}
