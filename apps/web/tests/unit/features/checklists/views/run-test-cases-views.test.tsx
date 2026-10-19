import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { testCasesRepository } from "../../../../../src/features/checklists/data/test-cases-repository";
import { normalizeProjectRun } from "../../../../../src/features/checklists/model/project-run-rules";
import type { ProjectQaRun, ProjectQaRunPermissions } from "../../../../../src/features/checklists/model/project-run-types";
import { RunTestCases } from "../../../../../src/features/checklists/studio/views/run-test-cases";
import {
  useRunTestCasesViewModel,
  type RunTestCasesViewModel,
} from "../../../../../src/features/checklists/studio/view-models/use-run-test-cases-view-model";
import { apiErrorWith } from "../qa-promotion-fixtures";
import { projectRunWire, runItemWire } from "../requirement-fixtures";

jest.mock("../../../../../src/features/checklists/data/project-qa-runs-repository", () => ({
  projectQaRunsRepository: { setTestCaseResult: jest.fn() },
}));

jest.mock("../../../../../src/features/checklists/data/test-cases-repository", () => ({
  testCasesRepository: {
    addCategory: jest.fn().mockResolvedValue([]),
    renameCategory: jest.fn().mockResolvedValue([]),
    deleteCategory: jest.fn().mockResolvedValue([]),
    addTestCase: jest.fn().mockResolvedValue([]),
    updateTestCase: jest.fn().mockResolvedValue([]),
    deleteTestCase: jest.fn().mockResolvedValue([]),
  },
}));

const runs = projectQaRunsRepository as jest.Mocked<typeof projectQaRunsRepository>;
const definitions = testCasesRepository as jest.Mocked<typeof testCasesRepository>;

const QA: ProjectQaRunPermissions = {
  canSetVerification: true,
  canSignOff: true,
  canReopen: false,
  canDispatch: true,
  canManageTestCases: true,
};
const LEAD: ProjectQaRunPermissions = { ...QA, canReopen: true, canManageTestCases: false };
const DEVELOPER: ProjectQaRunPermissions = {
  canSetVerification: false,
  canSignOff: false,
  canReopen: false,
  canDispatch: false,
  canManageTestCases: false,
};

function testCase(overrides: Record<string, unknown> = {}) {
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
    rowVersion: 3,
    definitionRowVersion: 2,
    ...overrides,
  };
}

function runWith(testCases: Array<Record<string, unknown>>, overrides: Record<string, unknown> = {}): ProjectQaRun {
  return normalizeProjectRun(
    projectRunWire({
      items: [
        runItemWire({
          sourceItemId: "story-1",
          testCategories: [{ id: "cat-1", name: "Happy path", rowVersion: 4, testCases }],
        }),
        runItemWire({ id: "run-item-2", position: 1, requirementKind: "system", sourceItemId: "sys-1" }),
      ],
      ...overrides,
    }),
  )!;
}

let root: Root | null = null;
const latest: { vm: RunTestCasesViewModel | null } = { vm: null };

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  latest.vm = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

/** Renders the real section for the run's first item, with the real ViewModel behind it. */
function mount(run: ProjectQaRun, permissions: ProjectQaRunPermissions, itemIndex = 0) {
  const onRun = jest.fn();
  const onReload = jest.fn();
  const keep = (vm: RunTestCasesViewModel) => {
    latest.vm = vm;
  };
  function Harness({ value, onVm }: { value: ProjectQaRun; onVm: (vm: RunTestCasesViewModel) => void }) {
    const vm = useRunTestCasesViewModel({ deliveryProjectId: "dp-1", run: value, permissions, onRun, onReload });
    onVm(vm);
    return <RunTestCases item={value.items[itemIndex]} vm={vm} onReload={onReload} />;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<Harness value={run} onVm={keep} />));
  return { container, onRun, onReload, vm: () => latest.vm! };
}

async function flush() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function button(container: HTMLElement, name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === name || element.getAttribute("aria-label") === name,
  );
  if (!found) throw new Error(`no button ${name}`);
  return found;
}

function type(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("RunTestCases for the QA Team", () => {
  it("shows the story's test cases by category with a count, open while one is unresolved", () => {
    const { container } = mount(runWith([testCase(), testCase({ id: "rtc-2", sourceTestCaseId: "tc-2", position: 1, status: "failed" })]), QA);
    const section = container.querySelector("details.pqa-tests") as HTMLDetailsElement;
    expect(section.open).toBe(true);
    expect(container.querySelector(".pqa-tests__count")?.textContent).toBe("0/2 passed");
    expect(container.querySelector(".pqa-tests__attention")?.textContent).toBe("1 failed");
    expect(container.querySelector(".pqa-tests__category-name")?.textContent).toBe("Happy path");
    expect(container.textContent).toContain("Expected: The profile shows in the header");
  });

  it("records a result the moment it is picked, with the run copy's row version", async () => {
    const run = runWith([testCase()]);
    runs.setTestCaseResult.mockResolvedValue(run);
    const { container, onRun } = mount(run, QA);

    const select = container.querySelector('select[aria-label="Result of Logs in with a saved password"]') as HTMLSelectElement;
    act(() => {
      select.value = "passed";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    expect(runs.setTestCaseResult).toHaveBeenCalledWith("dp-1", "prun-1", "run-item-1", "rtc-1", {
      status: "passed",
      expectedRowVersion: 3,
    });
    expect(onRun).toHaveBeenCalledWith(run);
  });

  it("adds a category on the story, then reads the run again", async () => {
    const { container, onReload } = mount(runWith([]), QA);

    act(() => button(container, "+ Add test case category").click());
    type(container.querySelector("input.hier-input") as HTMLInputElement, "  Session ");
    await act(async () => {
      (container.querySelector('form[aria-label="New test case category"]') as HTMLFormElement).requestSubmit();
    });
    await flush();

    expect(definitions.addCategory).toHaveBeenCalledWith("req-1", "story-1", "Session");
    expect(onReload).toHaveBeenCalled();
    expect(container.querySelector("form")).toBeNull();
  });

  it("refuses to send a blank test case and says why", async () => {
    const { container } = mount(runWith([]), QA);

    act(() => button(container, "+ Add test case").click());
    await act(async () => {
      (container.querySelector('form[aria-label="New test case in Happy path"]') as HTMLFormElement).requestSubmit();
    });

    expect(definitions.addTestCase).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Describe what to test.");
  });

  it("adds a test case with its expected result into the category", async () => {
    const { container } = mount(runWith([]), QA);

    act(() => button(container, "+ Add test case").click());
    const [title, expected] = [
      container.querySelector("input.hier-input") as HTMLInputElement,
      container.querySelector("textarea.hier-textarea") as HTMLTextAreaElement,
    ];
    type(title, "Session expires after 30 minutes");
    type(expected, "  ");
    await act(async () => {
      (container.querySelector("form") as HTMLFormElement).requestSubmit();
    });
    await flush();

    expect(definitions.addTestCase).toHaveBeenCalledWith("req-1", "story-1", "cat-1", {
      title: "Session expires after 30 minutes",
      expectedResult: null,
    });
  });

  it("edits a test case with the definition's row version, and deletes one after a second click", async () => {
    const { container } = mount(runWith([testCase()]), QA);

    act(() => button(container, "Edit").click());
    type(container.querySelector("input.hier-input") as HTMLInputElement, "Logs in (saved password)");
    await act(async () => {
      (container.querySelector("form") as HTMLFormElement).requestSubmit();
    });
    await flush();
    expect(definitions.updateTestCase).toHaveBeenCalledWith("req-1", "story-1", "tc-1", {
      title: "Logs in (saved password)",
      expectedResult: "The profile shows in the header",
      expectedRowVersion: 2,
    });

    act(() => button(container, "Delete test case Logs in with a saved password").click());
    expect(definitions.deleteTestCase).not.toHaveBeenCalled();
    act(() => button(container, "Yes").click());
    await flush();
    expect(definitions.deleteTestCase).toHaveBeenCalledWith("req-1", "story-1", "tc-1");
  });

  it("offers Reload run when someone else changed the test case", async () => {
    runs.setTestCaseResult.mockRejectedValue(apiErrorWith(409, { code: "TEST_CASE_STALE" }));
    const { container, onReload, vm } = mount(runWith([testCase()]), QA);

    act(() => vm().setResult(runWith([testCase()]).items[0], runWith([testCase()]).items[0].testCategories[0].testCases[0], "failed"));
    await flush();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Someone else changed this test case");
    act(() => button(container, "Reload run").click());
    expect(onReload).toHaveBeenCalled();
  });
});

describe("RunTestCases for everyone else", () => {
  it("a Product owner records results but cannot write test cases", () => {
    const { container } = mount(runWith([testCase()]), LEAD);
    expect(container.querySelector("select")).not.toBeNull();
    expect(container.textContent).not.toContain("+ Add test case");
    expect(container.textContent).not.toContain("Edit");
  });

  it("a Developer sees each result as text, and nothing to change", () => {
    const { container } = mount(runWith([testCase({ status: "blocked" })]), DEVELOPER);
    expect(container.querySelector("select")).toBeNull();
    expect(container.querySelector(".pqa-test__status")?.textContent).toBe("Blocked");
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("a signed-off run is read-only even for the QA Team", () => {
    const { container } = mount(runWith([testCase({ status: "passed" })], { status: "signed_off" }), QA);
    expect(container.querySelector("select")).toBeNull();
    expect(container.textContent).not.toContain("+ Add");
  });

  it("is hidden on a System item, and on a story without test cases for a viewer who cannot add one", () => {
    expect(mount(runWith([]), QA, 1).container.innerHTML).toBe("");
    act(() => root?.unmount());
    root = null;
    expect(mount(runWith([]), LEAD).container.querySelector(".pqa-tests__category")).not.toBeNull();
    act(() => root?.unmount());
    root = null;
    const empty = normalizeProjectRun(projectRunWire())!;
    expect(mount(empty, LEAD).container.innerHTML).toBe("");
  });
});
