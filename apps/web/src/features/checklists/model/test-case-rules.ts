/* Pure QA test case rules: reading the wire, counting, labels and who may
 * write. No React, no fetch.
 *
 * Every "may" mirrors a server rule and is never looser than it: the run's
 * flag wins, and the app-role allow-list (QA Team and admins write test
 * cases) stands in only when the flag is missing. */

import type { AppRole } from "@/shared/api/contracts";

import type { QaActor } from "./qa-run-types";
import type {
  RunTestCase,
  RunTestCategory,
  TestCaseCounts,
  TestCaseDefinition,
  TestCaseForm,
  TestCaseStatus,
  TestCategoryDefinition,
} from "./test-case-types";
import { oneOf, record, records, text, type Loose } from "./wire-readers";

type Role = AppRole | null | undefined;

/** Every result a run can hold, as the server sends it (older test cases may read Blocked or N/A). */
export const TEST_CASE_STATUSES: ReadonlyArray<TestCaseStatus> = [
  "pending",
  "passed",
  "failed",
  "blocked",
  "not_applicable",
];

/** What QA can set on a test case: Pending, Passed or Failed. */
export const SETTABLE_TEST_CASE_STATUSES: ReadonlyArray<TestCaseStatus> = ["pending", "passed", "failed"];

/** The choices a result control offers: the settable ones, plus the current value when it is an older one. */
export function testCaseStatusChoices(current: TestCaseStatus): TestCaseStatus[] {
  return SETTABLE_TEST_CASE_STATUSES.includes(current)
    ? [...SETTABLE_TEST_CASE_STATUSES]
    : [...SETTABLE_TEST_CASE_STATUSES, current];
}

/** Results that keep the story from passing. */
export const OPEN_TEST_CASE_STATUSES: ReadonlyArray<TestCaseStatus> = ["pending", "failed", "blocked"];

const LABELS: Record<TestCaseStatus, string> = {
  pending: "Pending",
  passed: "Passed",
  failed: "Failed",
  blocked: "Blocked",
  not_applicable: "N/A",
};

export function testCaseStatusLabel(status: TestCaseStatus): string {
  return LABELS[status];
}

export type TestCaseTone = "success" | "danger" | "warning" | "muted";

const TONES: Record<TestCaseStatus, TestCaseTone> = {
  pending: "muted",
  passed: "success",
  failed: "danger",
  blocked: "warning",
  not_applicable: "muted",
};

export function testCaseTone(status: TestCaseStatus): TestCaseTone {
  return TONES[status];
}

/** Writing test cases: the QA Team and admins. Product owners write the stories instead. */
export function canManageTestCases(role: Role): boolean {
  return role === "qa" || role === "admin";
}

/* ── Reading the wire ───────────────────────────────────────────────────── */

function positionOf(raw: Loose): number {
  return typeof raw.position === "number" && Number.isFinite(raw.position) ? raw.position : 0;
}

function versionOf(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function actorFrom(value: unknown): QaActor | null {
  const raw = record(value);
  const id = text(raw?.id);
  const login = text(raw?.login);
  return id && login ? { id, login } : null;
}

function byPosition<T extends { position: number }>(list: T[]): T[] {
  return list.sort((a, b) => a.position - b.position);
}

function runTestCaseFrom(raw: Loose): RunTestCase | null {
  const id = text(raw.id);
  const title = text(raw.title);
  const status = oneOf(raw.status, TEST_CASE_STATUSES);
  if (!id || !title || !status) return null;
  return {
    id,
    sourceTestCaseId: text(raw.sourceTestCaseId),
    position: positionOf(raw),
    title,
    expectedResult: text(raw.expectedResult),
    status,
    notes: text(raw.notes),
    verifiedBy: actorFrom(raw.verifiedBy),
    verifiedAt: text(raw.verifiedAt),
    rowVersion: versionOf(raw.rowVersion),
    definitionRowVersion: versionOf(raw.definitionRowVersion),
  };
}

/** A run item's test cases by category. Absent or broken: none (an older backend or report). */
export function normalizeRunTestCategories(value: unknown): RunTestCategory[] {
  return records(value).flatMap((raw) => {
    const name = text(raw.name);
    if (!name) return [];
    const testCases = records(raw.testCases)
      .map(runTestCaseFrom)
      .filter((testCase): testCase is RunTestCase => testCase !== null);
    return [{ id: text(raw.id), name, rowVersion: versionOf(raw.rowVersion), testCases: byPosition(testCases) }];
  });
}

function definitionFrom(raw: Loose): TestCaseDefinition | null {
  const id = text(raw.id);
  const title = text(raw.title);
  if (!id || !title) return null;
  return {
    id,
    position: positionOf(raw),
    title,
    expectedResult: text(raw.expectedResult),
    rowVersion: versionOf(raw.rowVersion),
  };
}

/** A story's test case definitions. Absent or broken: none. */
export function normalizeTestCategories(value: unknown): TestCategoryDefinition[] {
  const categories = records(value).flatMap((raw) => {
    const id = text(raw.id);
    const name = text(raw.name);
    if (!id || !name) return [];
    const testCases = records(raw.testCases)
      .map(definitionFrom)
      .filter((testCase): testCase is TestCaseDefinition => testCase !== null);
    return [{ id, position: positionOf(raw), name, rowVersion: versionOf(raw.rowVersion), testCases: byPosition(testCases) }];
  });
  return byPosition(categories);
}

/* ── Counting ───────────────────────────────────────────────────────────── */

export function countTestCases(categories: ReadonlyArray<Pick<RunTestCategory, "testCases">>): TestCaseCounts {
  const counts: TestCaseCounts = { total: 0, passed: 0, notApplicable: 0, failed: 0, blocked: 0, pending: 0, open: 0 };
  for (const testCase of categories.flatMap((category) => category.testCases)) {
    counts.total += 1;
    if (testCase.status === "passed") counts.passed += 1;
    else if (testCase.status === "not_applicable") counts.notApplicable += 1;
    else if (testCase.status === "failed") counts.failed += 1;
    else if (testCase.status === "blocked") counts.blocked += 1;
    else counts.pending += 1;
  }
  counts.open = counts.failed + counts.blocked + counts.pending;
  return counts;
}

/** "3/5 passed", counting N/A as done; "No test cases yet" when there are none. */
export function testCasesProgressLabel(counts: TestCaseCounts): string {
  if (counts.total === 0) return "No test cases yet";
  return `${String(counts.passed + counts.notApplicable)}/${String(counts.total)} passed`;
}

/** The problems worth a glance, in order: "1 failed · 1 blocked". Empty when there are none. */
export function testCasesAttentionLabel(counts: TestCaseCounts): string {
  const parts = [
    counts.failed > 0 ? `${String(counts.failed)} failed` : null,
    counts.blocked > 0 ? `${String(counts.blocked)} blocked` : null,
  ];
  return parts.filter((part): part is string => part !== null).join(" · ");
}

/* ── Forms ──────────────────────────────────────────────────────────────── */

function categoryNameError(name: string): string | null {
  if (!name.trim()) return "Give the category a name.";
  return name.trim().length > 120 ? "A category name is at most 120 characters." : null;
}

function testCaseError(title: string, expectedResult: string): string | null {
  if (!title.trim()) return "Describe what to test.";
  if (title.trim().length > 300) return "A test case is at most 300 characters.";
  return expectedResult.trim().length > 2000 ? "An expected result is at most 2000 characters." : null;
}

/** Why the open form cannot be sent yet, or null when it can. Same limits as the server. */
export function testCaseFormError(form: TestCaseForm): string | null {
  if (form.mode === "add-category" || form.mode === "rename-category") return categoryNameError(form.name);
  if (form.mode === "add-case" || form.mode === "edit-case") return testCaseError(form.title, form.expectedResult);
  return form.notes.length > 4000 ? "A note is at most 4000 characters." : null;
}

/** Trimmed text, or null when blank (the server stores a blank expected result or note as none). */
export function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
