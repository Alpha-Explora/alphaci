/* QA test case types. Pure: no React, no fetch, no Next.
 *
 * The QA Team writes test cases under a User story: named categories ("Happy
 * path", "Validation") holding test cases (a title and an optional expected
 * result). Each Project run keeps its own copy of a story's test cases with
 * QA's result, so a run says exactly what was tested on its heads. A story is
 * passed only once every one of its test cases is passed or not applicable.
 * (Backend: ADR-0014, amendment 10.) */

import type { QaActor } from "./qa-run-types";

export type TestCaseStatus = "pending" | "passed" | "failed" | "blocked" | "not_applicable";

/** One test case as tested in a run. */
export interface RunTestCase {
  id: string;
  /** The definition it was copied from; null once that was deleted. */
  sourceTestCaseId: string | null;
  position: number;
  title: string;
  expectedResult: string | null;
  status: TestCaseStatus;
  notes: string | null;
  verifiedBy: QaActor | null;
  verifiedAt: string | null;
  /** The run copy's version, sent back with a result. Null: read-only. */
  rowVersion: number | null;
  /** The definition's version, sent back with an edit. Null: not editable from here. */
  definitionRowVersion: number | null;
}

/** A category of a story's test cases in a run. */
export interface RunTestCategory {
  /** The category definition; null once it was deleted (a signed-off run keeps the name). */
  id: string | null;
  name: string;
  /** The definition's version, sent back with a rename. Null: not editable from here. */
  rowVersion: number | null;
  testCases: RunTestCase[];
}

/** A test case as written under a story (no result). */
export interface TestCaseDefinition {
  id: string;
  position: number;
  title: string;
  expectedResult: string | null;
  rowVersion: number | null;
}

export interface TestCategoryDefinition {
  id: string;
  position: number;
  name: string;
  rowVersion: number | null;
  testCases: TestCaseDefinition[];
}

/** How a story's test cases stand in one run. `open` = pending, failed or blocked. */
export interface TestCaseCounts {
  total: number;
  passed: number;
  notApplicable: number;
  failed: number;
  blocked: number;
  pending: number;
  open: number;
}

/** PATCH .../qa-runs/:runId/items/:itemId/test-cases/:testCaseId */
export interface SetTestCaseResultInput {
  expectedRowVersion: number;
  status?: TestCaseStatus;
  notes?: string | null;
}

export interface TestCaseInput {
  title: string;
  expectedResult: string | null;
}

/**
 * The one form open in a story's Test cases section. Strings, so the inputs
 * stay controlled. `itemId` is the run item the form sits under.
 */
export type TestCaseForm =
  | { mode: "add-category"; itemId: string; name: string }
  | { mode: "rename-category"; itemId: string; categoryId: string; rowVersion: number; name: string }
  | { mode: "add-case"; itemId: string; categoryId: string; title: string; expectedResult: string }
  | {
      mode: "edit-case";
      itemId: string;
      testCaseId: string;
      rowVersion: number;
      title: string;
      expectedResult: string;
    }
  | { mode: "note"; itemId: string; runTestCaseId: string; rowVersion: number; notes: string };
