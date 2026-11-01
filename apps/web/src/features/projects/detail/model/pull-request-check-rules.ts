/**
 * How a pull request's checks read on its expanded card.
 *
 * The card used to print GitHub's list as it came: one pill and one name per
 * check, in GitHub's order, with two rows reading `build` side by side because
 * two workflows both have a job called that. Every rule here decides one thing
 * the Checks panel says — the count line, the ALPHACI stage pills, which
 * workflow a check belongs to, which of two same-named checks is which, and
 * what comes first — so the panel cannot contradict its own summary.
 *
 * Structural input types rather than the API's: a backend older than #150
 * sends only name, status and conclusion, and every rule below has to read
 * that shape too.
 */

import type { StageId } from "@/shared/api/contracts";

import { stageName } from "./pipeline-run-card-rules";

/** The fields the rules read; everything past `conclusion` may be absent. */
export interface ReadableCheck {
  name: string;
  status: string;
  conclusion: string | null;
  id?: number | null;
  kind?: "check-run" | "status";
  workflowName?: string | null;
  event?: string | null;
  jobId?: number | null;
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  annotations?: readonly unknown[];
}

export type CheckTone = "success" | "failure" | "running" | "neutral";

const FAILED_CONCLUSIONS = new Set(["failure", "timed_out", "error", "startup_failure"]);

/**
 * A check's outcome as one of four tones. A commit status's `error` (our
 * stage was cancelled) counts as failed: the merge is blocked either way.
 */
export function pullRequestCheckTone(check: Pick<ReadableCheck, "status" | "conclusion">): CheckTone {
  if (check.status !== "completed") return "running";
  if (check.conclusion === "success") return "success";
  if (check.conclusion && FAILED_CONCLUSIONS.has(check.conclusion)) return "failure";
  return "neutral";
}

/* ── The count line ─────────────────────────────────────────────────────── */

export interface ChecksSummary {
  total: number;
  passed: number;
  failed: number;
  running: number;
  /** Skipped, cancelled, neutral: finished without a verdict either way. */
  other: number;
  /** "6 checks · 4 passed · 1 failed · 1 running". */
  label: string;
}

function countLabel(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

export function summarizePullRequestChecks(checks: readonly ReadableCheck[]): ChecksSummary {
  const counts: Record<CheckTone, number> = { success: 0, failure: 0, running: 0, neutral: 0 };
  for (const check of checks) counts[pullRequestCheckTone(check)] += 1;

  const parts = [countLabel(checks.length, "check", "checks"), `${String(counts.success)} passed`];
  if (counts.failure > 0) parts.push(`${String(counts.failure)} failed`);
  if (counts.running > 0) parts.push(`${String(counts.running)} running`);
  if (counts.neutral > 0) parts.push(`${String(counts.neutral)} skipped or neutral`);

  return {
    total: checks.length,
    passed: counts.success,
    failed: counts.failure,
    running: counts.running,
    other: counts.neutral,
    label: parts.join(" · "),
  };
}

/**
 * Open the full list without a click when anything failed or is still
 * running: those are the checks someone opened the pull request to read. A
 * clean pull request stays one line and the stage pills.
 */
export function checksStartExpanded(summary: ChecksSummary): boolean {
  return summary.failed > 0 || summary.running > 0;
}

/* ── ALPHACI's own stages ───────────────────────────────────────────────── */

const STAGE_ORDER: readonly StageId[] = ["access", "quality", "package", "verify"];
const STAGE_STATUS = /^alphaci\/(access|quality|package|verify)$/;

/**
 * Our pipeline posts one commit status per stage (`alphaci/quality`). Read
 * by name as well as kind, because an older backend sends no `kind`.
 */
export function stageOfCheck(check: ReadableCheck): StageId | null {
  if (check.kind === "check-run") return null;
  const match = STAGE_STATUS.exec(check.name);
  return match ? (match[1] as StageId) : null;
}

export interface StagePill {
  stage: StageId;
  label: string;
  tone: CheckTone;
  /** ✓, ✗ or •, so the pill reads without its colour. */
  mark: string;
}

const MARKS: Record<CheckTone, string> = {
  success: "✓",
  failure: "✗",
  running: "•",
  neutral: "•",
};

/** Access → Quality → Package → Verify, for the stages that posted a status. */
export function stagePills(checks: readonly ReadableCheck[]): StagePill[] {
  return STAGE_ORDER.flatMap((stage) => {
    const check = checks.find((candidate) => stageOfCheck(candidate) === stage);
    if (!check) return [];
    const tone = pullRequestCheckTone(check);
    return [{ stage, label: stageName(stage), tone, mark: MARKS[tone] }];
  });
}

/* ── Every other check, grouped by workflow ─────────────────────────────── */

export const OTHER_CHECKS_GROUP = "Other checks";

export interface CheckRow<T extends ReadableCheck = ReadableCheck> {
  /** Stable React key: the check-run id, else name and position. */
  key: string;
  check: T;
  tone: CheckTone;
  /**
   * "Quality · pull_request" when another check has the same name, so two
   * rows reading `build` can be told apart; null when the name is unique or
   * there is nothing to tell them apart by.
   */
  qualifier: string | null;
}

export interface CheckGroup<T extends ReadableCheck = ReadableCheck> {
  name: string;
  rows: CheckRow<T>[];
  /** The group's worst tone, for ordering the groups. */
  tone: CheckTone;
}

const TONE_RANK: Record<CheckTone, number> = { failure: 0, running: 1, success: 2, neutral: 3 };

function byTone(left: { tone: CheckTone }, right: { tone: CheckTone }): number {
  return TONE_RANK[left.tone] - TONE_RANK[right.tone];
}

function qualifierOf(check: ReadableCheck): string | null {
  const parts = [check.workflowName, check.event].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

function rowKey(check: ReadableCheck, index: number): string {
  return check.id != null ? `id-${String(check.id)}` : `${check.name}-${String(index)}`;
}

function nameUses(checks: readonly ReadableCheck[]): Map<string, number> {
  const uses = new Map<string, number>();
  for (const check of checks) uses.set(check.name, (uses.get(check.name) ?? 0) + 1);
  return uses;
}

/**
 * The checks that are not stage statuses, grouped under the workflow they
 * belong to ("Other checks" for apps, statuses and an older backend), failed
 * first, then running, then passed — within each group and across them.
 */
export function groupPullRequestChecks<T extends ReadableCheck>(checks: readonly T[]): CheckGroup<T>[] {
  const rest = checks
    .map((check, index) => ({ check, index }))
    .filter(({ check }) => stageOfCheck(check) === null);
  const uses = nameUses(rest.map(({ check }) => check));

  const groups = new Map<string, CheckRow<T>[]>();
  for (const { check, index } of rest) {
    const name = check.workflowName || OTHER_CHECKS_GROUP;
    const rows = groups.get(name) ?? [];
    rows.push({
      key: rowKey(check, index),
      check,
      tone: pullRequestCheckTone(check),
      qualifier: (uses.get(check.name) ?? 0) > 1 ? qualifierOf(check) : null,
    });
    groups.set(name, rows);
  }

  return [...groups.entries()]
    .map(([name, rows]) => {
      const sorted = [...rows].sort(byTone);
      return { name, rows: sorted, tone: sorted[0]?.tone ?? "neutral" };
    })
    .sort((left, right) => byTone(left, right) || groupOrder(left.name, right.name));
}

/** "Other checks" after the named workflows when the tones tie. */
function groupOrder(left: string, right: string): number {
  if (left === OTHER_CHECKS_GROUP) return right === OTHER_CHECKS_GROUP ? 0 : 1;
  return right === OTHER_CHECKS_GROUP ? -1 : 0;
}

/* ── One check, opened ──────────────────────────────────────────────────── */

/** Whether a check carries anything worth opening it for. */
export function checkHasDetail(check: ReadableCheck): boolean {
  return Boolean(
    check.title ||
      check.summary ||
      check.description ||
      (check.annotations && check.annotations.length > 0) ||
      check.jobId != null,
  );
}

/** A failed check with something to say opens without a click. */
export function checkStartsOpen(row: Pick<CheckRow, "check" | "tone">): boolean {
  return row.tone === "failure" && checkHasDetail(row.check);
}

/** "src/app.ts:12", or the path alone for a file-level annotation. */
export function annotationLocation(annotation: { path: string; line: number | null }): string {
  return annotation.line != null ? `${annotation.path}:${String(annotation.line)}` : annotation.path;
}

/** GitHub's annotation level as a tone the list can colour. */
export function annotationTone(level: string): "failure" | "warning" | "neutral" {
  if (level === "failure") return "failure";
  if (level === "warning") return "warning";
  return "neutral";
}
