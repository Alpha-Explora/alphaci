/* Browser test records — reading them from the wire, ordering and wording
 * them. Pure: no React, no fetch.
 *
 * The records come from the central Playwright workflow (one per test: title,
 * what it checks, steps, notes, error). A server that predates them sends
 * none; the passing names (`passes`) are then the fallback. */

import type { TestCase, TestCaseStatus } from "@/shared/api/contracts";

const STATUSES: readonly TestCaseStatus[] = ["passed", "failed", "flaky", "skipped"];

type Loose = Record<string, unknown>;

function record(value: unknown): Loose | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Loose) : null;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function stepsOf(value: unknown): TestCase["steps"] {
  if (!Array.isArray(value)) return undefined;
  const steps = value.flatMap((entry) => {
    const step = record(entry);
    const title = text(step?.title);
    if (!step || !title) return [];
    return [{ title, durationMs: count(step.durationMs), failed: step.failed === true }];
  });
  return steps.length > 0 ? steps : undefined;
}

function notesOf(value: unknown): TestCase["notes"] {
  if (!Array.isArray(value)) return undefined;
  const notes = value.flatMap((entry) => {
    const note = record(entry);
    const type = text(note?.type);
    const body = text(note?.text);
    return type && body ? [{ type, text: body }] : [];
  });
  return notes.length > 0 ? notes : undefined;
}

function errorOf(value: unknown): TestCase["error"] {
  const error = record(value);
  const message = text(error?.message);
  return message ? { message, location: text(error?.location) } : undefined;
}

function caseOf(value: unknown): TestCase | null {
  const raw = record(value);
  const title = text(raw?.title);
  const status = STATUSES.find((known) => known === raw?.status);
  if (!raw || !title || !status) return null;
  return {
    title,
    status,
    file: text(raw.file),
    line: count(raw.line),
    project: text(raw.project),
    durationMs: count(raw.durationMs),
    retries: count(raw.retries),
    description: text(raw.description),
    notes: notesOf(raw.notes),
    steps: stepsOf(raw.steps),
    error: errorOf(raw.error),
  };
}

/**
 * The records as the server sent them, malformed ones dropped. Null when it
 * sent none: an older pipeline, so the caller falls back to the names.
 */
export function normalizeTestCases(value: unknown): TestCase[] | null {
  if (!Array.isArray(value)) return null;
  return value.map(caseOf).filter((entry): entry is TestCase => entry !== null);
}

/** Passing names as minimal records, for a pipeline that sends no detail. */
export function casesFromPasses(passes: readonly string[] | undefined): TestCase[] {
  return (passes ?? []).map((title) => ({ title, status: "passed" as const }));
}

/* ── Wording ────────────────────────────────────────────────────────────── */

const STATUS_WORDS: Record<TestCaseStatus, string> = {
  passed: "Passed",
  failed: "Failed",
  flaky: "Passed on retry",
  skipped: "Skipped",
};

export function testCaseStatusWord(status: TestCaseStatus): string {
  return STATUS_WORDS[status];
}

export type TestCaseTone = "success" | "danger" | "warning" | "muted";

const STATUS_TONES: Record<TestCaseStatus, TestCaseTone> = {
  passed: "success",
  failed: "danger",
  flaky: "warning",
  skipped: "muted",
};

export function testCaseTone(status: TestCaseStatus): TestCaseTone {
  return STATUS_TONES[status];
}

/**
 * The test's own name, without the spec file the title starts with:
 * "a11y.e2e-spec.ts > no critical … on /" reads "no critical … on /". The
 * describe blocks stay, joined with an arrow.
 */
export function testCaseName(test: Pick<TestCase, "title">): string {
  const parts = test.title.split(" > ");
  const named = parts.length > 1 && /\.(spec|test|e2e-spec)\.[cm]?[jt]sx?$/.test(parts[0] ?? "") ? parts.slice(1) : parts;
  return named.join(" › ");
}

/** "1.2 s" or "340 ms"; null when unknown. */
export function durationLabel(ms: number | undefined): string | null {
  if (ms === undefined) return null;
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${String(ms)} ms`;
}

/** "tests/e2e/a11y.e2e-spec.ts:11 · chromium · 1.8 s · 1 retry". */
export function testCaseMeta(test: TestCase): string {
  const where = test.file ? `${test.file}${test.line !== undefined ? `:${String(test.line)}` : ""}` : null;
  const retries = test.retries ? `${String(test.retries)} ${test.retries === 1 ? "retry" : "retries"}` : null;
  return [where, test.project ?? null, durationLabel(test.durationMs), retries]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

/** A note's label: "result" reads "Result", "visual" reads "Screenshot". */
export function noteLabel(type: string): string {
  if (type.toLowerCase() === "visual") return "Screenshot";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/** Whether a test has anything to unfold: steps, notes beyond nothing, or an error. */
export function hasTestDetail(test: TestCase): boolean {
  return Boolean(test.error) || (test.steps?.length ?? 0) > 0;
}

/** Failures first, then passed on retry, passed, skipped; otherwise as the run listed them. */
export function orderTestCases(cases: readonly TestCase[]): TestCase[] {
  const rank: Record<TestCaseStatus, number> = { failed: 0, flaky: 1, passed: 2, skipped: 3 };
  return cases
    .map((test, index) => ({ test, index }))
    .sort((a, b) => rank[a.test.status] - rank[b.test.status] || a.index - b.index)
    .map(({ test }) => test);
}

/** "6 tests · 1 failed" or "6 of 40 tests listed · 1 failed". */
export function testListHeading(cases: readonly TestCase[], total: number | null | undefined): string {
  const listed = cases.length;
  const failed = cases.filter((test) => test.status === "failed").length;
  const head =
    total !== null && total !== undefined && total > listed
      ? `${String(listed)} of ${String(total)} tests listed`
      : `${String(listed)} ${listed === 1 ? "test" : "tests"}`;
  return failed > 0 ? `${head} · ${String(failed)} failed` : head;
}
