import {
  allowedVerificationStatuses,
  canPass,
  normalizeProjectRun,
  passedUnavailableReason,
} from "../../../../../src/features/checklists/model/project-run-rules";
import { normalizeRequirementItem } from "../../../../../src/features/checklists/model/requirement-rules";
import {
  blankToNull,
  canManageTestCases,
  countTestCases,
  normalizeRunTestCategories,
  normalizeTestCategories,
  testCaseFormError,
  testCasesAttentionLabel,
  testCasesProgressLabel,
} from "../../../../../src/features/checklists/model/test-case-rules";
import { itemWire, projectRunWire, runItemWire } from "../requirement-fixtures";

function runTestCaseWire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "rtc-1",
    sourceTestCaseId: "tc-1",
    position: 0,
    title: "Logs in with a saved password",
    expectedResult: "The profile shows in the header",
    status: "pending",
    notes: null,
    verifiedBy: null,
    verifiedAt: null,
    rowVersion: 1,
    definitionRowVersion: 1,
    ...overrides,
  };
}

function storyWith(testCases: Array<Record<string, unknown>>) {
  return runItemWire({
    testCategories: [{ id: "cat-1", name: "Happy path", rowVersion: 1, testCases }],
  });
}

describe("reading test cases from the wire", () => {
  it("reads a run item's categories and test cases in position order", () => {
    const categories = normalizeRunTestCategories([
      {
        id: "cat-1",
        name: "Happy path",
        rowVersion: 2,
        testCases: [runTestCaseWire({ id: "b", position: 1 }), runTestCaseWire({ id: "a", position: 0 })],
      },
    ]);
    expect(categories).toEqual([
      expect.objectContaining({ id: "cat-1", name: "Happy path", rowVersion: 2 }),
    ]);
    expect(categories[0].testCases.map((testCase) => testCase.id)).toEqual(["a", "b"]);
  });

  it("degrades: no array is none, a nameless category and a broken test case are dropped", () => {
    expect(normalizeRunTestCategories(undefined)).toEqual([]);
    const categories = normalizeRunTestCategories([
      { id: "x" },
      { id: null, name: "Deleted category", testCases: [runTestCaseWire({ status: "maybe" }), runTestCaseWire()] },
    ]);
    expect(categories).toHaveLength(1);
    expect(categories[0]).toMatchObject({ id: null, rowVersion: null });
    expect(categories[0].testCases).toHaveLength(1);
  });

  it("carries test cases on a run item and on a requirement item; an older backend sends none", () => {
    const run = normalizeProjectRun(projectRunWire({ items: [storyWith([runTestCaseWire()])] }))!;
    expect(run.items[0].testCategories[0].testCases[0].title).toBe("Logs in with a saved password");
    expect(normalizeProjectRun(projectRunWire())!.items[0].testCategories).toEqual([]);

    const item = normalizeRequirementItem(
      itemWire({
        testCategories: [
          { id: "cat-1", position: 0, name: "Happy path", rowVersion: 1, testCases: [{ id: "tc-1", position: 0, title: "Logs in", expectedResult: null, rowVersion: 1 }] },
        ],
      }),
      "req-1",
    )!;
    expect(item.testCategories[0].testCases[0].title).toBe("Logs in");
    expect(normalizeTestCategories([{ id: "c" }])).toEqual([]);
  });
});

describe("counting and labels", () => {
  const categories = normalizeRunTestCategories([
    {
      id: "cat-1",
      name: "Happy path",
      testCases: [
        runTestCaseWire({ id: "1", status: "passed" }),
        runTestCaseWire({ id: "2", status: "not_applicable" }),
        runTestCaseWire({ id: "3", status: "failed" }),
        runTestCaseWire({ id: "4", status: "blocked" }),
        runTestCaseWire({ id: "5" }),
      ],
    },
  ]);

  it("counts N/A as done and pending, failed and blocked as open", () => {
    expect(countTestCases(categories)).toEqual({
      total: 5,
      passed: 1,
      notApplicable: 1,
      failed: 1,
      blocked: 1,
      pending: 1,
      open: 3,
    });
    expect(testCasesProgressLabel(countTestCases(categories))).toBe("2/5 passed");
    expect(testCasesAttentionLabel(countTestCases(categories))).toBe("1 failed · 1 blocked");
    expect(testCasesProgressLabel(countTestCases([]))).toBe("No test cases yet");
    expect(testCasesAttentionLabel(countTestCases([]))).toBe("");
  });
});

describe("who writes test cases", () => {
  it("is the QA Team and admins, never a Product owner or a Developer", () => {
    expect(canManageTestCases("qa")).toBe(true);
    expect(canManageTestCases("admin")).toBe(true);
    expect(canManageTestCases("lead")).toBe(false);
    expect(canManageTestCases("member")).toBe(false);
    expect(canManageTestCases(undefined)).toBe(false);
  });
});

describe("Passed waits for every test case", () => {
  const CAN = { canSetVerification: true };
  const OPEN = { status: "open" as const };

  it("is not offered while a test case is pending, failed or blocked, and says why", () => {
    for (const status of ["pending", "failed", "blocked"]) {
      const item = normalizeProjectRun(projectRunWire({ items: [storyWith([runTestCaseWire({ status })])] }))!.items[0];
      expect(canPass(item)).toBe(false);
      expect(allowedVerificationStatuses(item, OPEN, CAN)).not.toContain("passed");
      expect(passedUnavailableReason(item)).toBe(
        "Pass every test case of this story before passing the story.",
      );
    }
  });

  it("is offered once every test case is passed or N/A, and Done still comes first", () => {
    const resolved = storyWith([runTestCaseWire({ status: "passed" }), runTestCaseWire({ id: "rtc-2", status: "not_applicable" })]);
    const item = normalizeProjectRun(projectRunWire({ items: [resolved] }))!.items[0];
    expect(canPass(item)).toBe(true);
    expect(passedUnavailableReason(item)).toBeNull();

    const notDone = normalizeProjectRun(projectRunWire({ items: [{ ...resolved, progress: "todo" }] }))!.items[0];
    expect(passedUnavailableReason(notDone)).toBe("A Developer marks this Done before QA can pass it.");
  });
});

describe("forms", () => {
  it("needs a name or a title, and keeps to the server's lengths", () => {
    expect(testCaseFormError({ mode: "add-category", itemId: "i", name: "  " })).toBe("Give the category a name.");
    expect(testCaseFormError({ mode: "add-category", itemId: "i", name: "x".repeat(121) })).toMatch(/120/);
    expect(testCaseFormError({ mode: "add-case", itemId: "i", categoryId: "c", title: "", expectedResult: "" })).toBe(
      "Describe what to test.",
    );
    expect(
      testCaseFormError({ mode: "edit-case", itemId: "i", testCaseId: "t", rowVersion: 1, title: "ok", expectedResult: "x".repeat(2001) }),
    ).toMatch(/2000/);
    expect(testCaseFormError({ mode: "note", itemId: "i", runTestCaseId: "r", rowVersion: 1, notes: "" })).toBeNull();
    expect(blankToNull("  ")).toBeNull();
    expect(blankToNull(" a ")).toBe("a");
  });
});
