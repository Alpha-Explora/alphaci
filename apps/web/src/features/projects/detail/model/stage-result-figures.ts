/**
 * A stage's own figures, as one compact row: "Tests 48 / 48 passed",
 * "Coverage 87% (min 80%)", "Lint 0 errors · 3 warnings".
 *
 * A failed stage is explained by our grading's sentences; a passed one used
 * to be explained by nothing at all, because sentences are the wrong shape for
 * a pass — its whole value is the numbers. These read the stored `results`
 * the backend now returns, for passes and failures alike.
 *
 * `results` is jsonb written by whichever pipeline version ran, so nothing in
 * it is trusted: a figure whose numbers are not numbers is left out rather
 * than drawn as "NaN%".
 */

import type { StageResults } from "@/shared/api/contracts";
import { stripAnsi } from "@/shared/ui/strip-ansi";

export type FigureTone = "success" | "danger" | "warning" | "muted";

export interface ResultFigure {
  id: "tests" | "coverage" | "lint" | "security" | "sonar";
  label: string;
  value: string;
  tone: FigureTone;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function counted(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function testsFigure(tests: StageResults["tests"]): ResultFigure | null {
  if (!tests || !isCount(tests.passed) || !isCount(tests.total)) return null;
  const failed = isCount(tests.failed) ? tests.failed : 0;
  return {
    id: "tests",
    label: "Tests",
    value: `${String(tests.passed)} / ${String(tests.total)} passed`,
    tone: failed > 0 ? "danger" : "success",
  };
}

/** One decimal at most: "87.5%", "87%". */
function percent(value: number): string {
  return `${String(Math.round(value * 10) / 10)}%`;
}

function coverageFigure(coverage: StageResults["coverage"]): ResultFigure | null {
  if (!coverage || !isCount(coverage.pct)) return null;
  const threshold = isCount(coverage.threshold) && coverage.threshold > 0 ? coverage.threshold : null;
  return {
    id: "coverage",
    label: "Coverage",
    value: threshold === null ? percent(coverage.pct) : `${percent(coverage.pct)} (min ${percent(threshold)})`,
    tone: threshold !== null && coverage.pct < threshold ? "danger" : "success",
  };
}

function lintTone(errors: number, warnings: number): FigureTone {
  if (errors > 0) return "danger";
  return warnings > 0 ? "warning" : "success";
}

function lintFigure(lint: StageResults["lint"]): ResultFigure | null {
  if (!lint || !isCount(lint.errors)) return null;
  const warnings = isCount(lint.warnings) ? lint.warnings : 0;
  return {
    id: "lint",
    label: "Lint",
    value: `${counted(lint.errors, "error", "errors")} · ${counted(warnings, "warning", "warnings")}`,
    tone: lintTone(lint.errors, warnings),
  };
}

function securityFigure(security: StageResults["security"]): ResultFigure | null {
  if (!security || !isCount(security.critical) || !isCount(security.high)) return null;
  return {
    id: "security",
    label: "Security",
    value: `${String(security.critical)} critical · ${String(security.high)} high`,
    tone: security.critical + security.high > 0 ? "danger" : "success",
  };
}

const SONAR_GATES: Record<string, { value: string; tone: FigureTone }> = {
  OK: { value: "Gate passed", tone: "success" },
  ERROR: { value: "Gate failed", tone: "danger" },
  WARN: { value: "Gate warning", tone: "warning" },
  UNKNOWN: { value: "Gate not read", tone: "warning" },
};

/**
 * "Gate passed". An analysis a setting stopped is said as such, and is not a
 * gate result; a gate nobody could read is not a pass either.
 */
function sonarFigure(sonar: StageResults["sonar"]): ResultFigure | null {
  if (!sonar) return null;
  if (sonar.blockedBy) return { id: "sonar", label: "Sonar", value: "Analysis blocked", tone: "warning" };
  if (!sonar.gate) return null;
  const known = SONAR_GATES[sonar.gate.toUpperCase()];
  return {
    id: "sonar",
    label: "Sonar",
    value: known?.value ?? `Gate ${sonar.gate.toLowerCase()}`,
    tone: known?.tone ?? "muted",
  };
}

/** The figures a stage reported, in reading order; empty when it sent none. */
export function stageResultFigures(results: StageResults | undefined): ResultFigure[] {
  if (!results) return [];
  return [
    testsFigure(results.tests),
    coverageFigure(results.coverage),
    lintFigure(results.lint),
    securityFigure(results.security),
    sonarFigure(results.sonar),
  ].filter((figure): figure is ResultFigure => figure !== null);
}

export interface TestFailure {
  name: string;
  message?: string;
}

function isNamedFailure(value: unknown): value is TestFailure {
  if (typeof value !== "object" || value === null) return false;
  const name = (value as { name?: unknown }).name;
  return typeof name === "string" && name !== "";
}

/** Stored Playwright text keeps the runner's colour codes; the page shows plain text. */
function plainFailure(failure: TestFailure): TestFailure {
  const name = stripAnsi(failure.name);
  return typeof failure.message === "string"
    ? { name, message: stripAnsi(failure.message) }
    : { name };
}

/**
 * The failing tests by name, for under a failed Tests figure. The reporting
 * workflow caps the list, so `more` counts the failures it left out.
 */
export function failedTests(results: StageResults | undefined): {
  failures: TestFailure[];
  more: number;
} {
  const tests = results?.tests;
  if (!tests) return { failures: [], more: 0 };
  const listed: unknown[] = Array.isArray(tests.failures) ? tests.failures : [];
  const failures = listed
    .filter((value): value is TestFailure => isNamedFailure(value))
    .map((failure) => plainFailure(failure));
  const failed = isCount(tests.failed) ? tests.failed : failures.length;
  return { failures, more: Math.max(0, failed - failures.length) };
}
