import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectQaRunsRepository } from "../../../../../src/features/checklists/data/project-qa-runs-repository";
import { testCasesRepository } from "../../../../../src/features/checklists/data/test-cases-repository";
import { normalizeProjectRunCurrent } from "../../../../../src/features/checklists/model/project-run-rules";
import { useProjectRunViewModel } from "../../../../../src/features/checklists/studio/view-models/use-project-run-view-model";
import { ProjectRunPanel } from "../../../../../src/features/checklists/studio/views/project-run-panel";
import { projectRunWire, runItemWire } from "../requirement-fixtures";

jest.mock("../../../../../src/features/checklists/data/project-qa-runs-repository", () => ({
  projectQaRunsRepository: { current: jest.fn(), setVerification: jest.fn(), signoff: jest.fn(), reopen: jest.fn() },
}));

jest.mock("../../../../../src/features/checklists/data/qa-attachments-repository", () => ({
  qaAttachmentsRepository: { listForRun: jest.fn().mockResolvedValue([]), listForItem: jest.fn(), upload: jest.fn(), remove: jest.fn() },
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

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function Harness() {
  const vm = useProjectRunViewModel({ deliveryProjectId: "dp-1", enabled: true });
  return <ProjectRunPanel deliveryProjectId="dp-1" vm={vm} appRole="qa" summaryShown={false} />;
}

function current(testCases: Array<Record<string, unknown>>) {
  return normalizeProjectRunCurrent({
    run: projectRunWire({
      items: [
        runItemWire({
          sourceItemId: "story-1",
          testCategories: [{ id: "cat-1", name: "Happy path", rowVersion: 1, testCases }],
        }),
      ],
    }),
    heads: [],
  });
}

function button(name: string): HTMLButtonElement {
  const found = [...document.body.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === name || element.getAttribute("aria-label") === name,
  );
  if (!found) throw new Error(`no button ${name}`);
  return found;
}

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("Edit test suite inside QA Studio", () => {
  it("stays open after adding a test case, and shows the new test case from the refreshed run", async () => {
    runs.current.mockResolvedValue(current([]));
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root!.render(<Harness />));
    await flush();

    await act(async () => button("+Create test cases").click());
    expect(document.body.querySelector(".pqa-suite")).not.toBeNull();

    runs.current.mockResolvedValue(
      current([
        {
          id: "rtc-1",
          sourceTestCaseId: "tc-1",
          position: 0,
          title: "Logs in with a saved password",
          expectedResult: null,
          status: "pending",
          notes: null,
          verifiedBy: null,
          verifiedAt: null,
          rowVersion: 1,
          definitionRowVersion: 1,
        },
      ]),
    );
    const suite = document.body.querySelector(".pqa-suite") as HTMLElement;
    await act(async () => button("+ Add test case").click());
    type(suite.querySelector("input.hier-input") as HTMLInputElement, "Logs in with a saved password");
    await act(async () => {
      (suite.querySelector('form[aria-label="New test case in Happy path"]') as HTMLFormElement).requestSubmit();
    });
    await flush();

    expect(definitions.addTestCase).toHaveBeenCalled();
    expect(document.body.querySelector(".pqa-suite")).not.toBeNull();
    expect(document.body.querySelector(".qa-run-skeleton, .qa-skeleton-card")).toBeNull();
    expect(document.body.querySelector(".pqa-suite__pane")?.textContent).toContain("Logs in with a saved password");
    expect(document.body.querySelector(".pqa-suite__story-count")?.textContent).toBe("1");
  });
});
