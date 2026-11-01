import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { normalizeProjectRun } from "../../../../../src/features/checklists/model/project-run-rules";
import type { ProjectQaRun, ProjectQaRunPermissions } from "../../../../../src/features/checklists/model/project-run-types";
import { TestCaseEditorDialog } from "../../../../../src/features/checklists/studio/views/test-case-editor-dialog";
import { useRunTestCasesViewModel } from "../../../../../src/features/checklists/studio/view-models/use-run-test-cases-view-model";
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

const QA: ProjectQaRunPermissions = {
  canSetVerification: true,
  canSignOff: true,
  canReopen: false,
  canDispatch: true,
  canManageTestCases: true,
  canRecordTestCases: true,
  canAccept: false,
};

/** Two Features: Login with two stories (the first with a test case), Checkout with one; plus a System item. */
function run(): ProjectQaRun {
  return normalizeProjectRun(
    projectRunWire({
      items: [
        runItemWire({
          id: "ri-login-1",
          sourceItemId: "story-login-1",
          requirementId: "req-login",
          requirementName: "Login",
          title: "As a customer, I can log in",
          testCategories: [
            {
              id: "cat-1",
              name: "Happy path",
              rowVersion: 1,
              testCases: [
                {
                  id: "rtc-1",
                  sourceTestCaseId: "tc-1",
                  position: 0,
                  title: "Logs in with a saved password",
                  expectedResult: null,
                  status: "failed",
                  notes: "Broke on Safari",
                  verifiedBy: null,
                  verifiedAt: null,
                  rowVersion: 2,
                  definitionRowVersion: 1,
                },
              ],
            },
          ],
        }),
        runItemWire({
          id: "ri-login-2",
          position: 1,
          sourceItemId: "story-login-2",
          requirementId: "req-login",
          requirementName: "Login",
          title: "As a customer, I can log out",
        }),
        runItemWire({
          id: "ri-checkout-1",
          position: 2,
          sourceItemId: "story-checkout-1",
          requirementId: "req-checkout",
          requirementName: "Checkout",
          title: "As a shopper, I can pay with a saved card",
        }),
        runItemWire({ id: "ri-sys", position: 3, requirementKind: "system", requirementName: "Smoke", sourceItemId: "sys-1" }),
      ],
    }),
  )!;
}

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

function mount() {
  const onClose = jest.fn();
  const value = run();
  function Harness() {
    const vm = useRunTestCasesViewModel({
      deliveryProjectId: "dp-1",
      run: value,
      permissions: QA,
      onRun: jest.fn(),
      onReload: jest.fn(),
    });
    return <TestCaseEditorDialog items={value.items} vm={vm} open onClose={onClose} onReload={jest.fn()} />;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<Harness />));
  return { onClose };
}

function button(name: string): HTMLButtonElement {
  const found = [...document.body.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === name || element.getAttribute("aria-label") === name,
  );
  if (!found) throw new Error(`no button ${name}`);
  return found;
}

function story(title: string): HTMLButtonElement {
  const found = [...document.body.querySelectorAll<HTMLButtonElement>(".pqa-suite__story")].find(
    (element) => element.title === title,
  );
  if (!found) throw new Error(`no story ${title}`);
  return found;
}

function heading(): string {
  return document.body.querySelector(".pqa-suite__story-heading")?.textContent ?? "";
}

describe("Edit test suite", () => {
  it("lists each Feature with its user stories on the left, and opens the first story", () => {
    mount();
    const features = [...document.body.querySelectorAll(".pqa-suite__feature-name")].map((node) => node.textContent);
    expect(features).toEqual(["Login", "Checkout"]);
    expect(document.body.querySelectorAll(".pqa-suite__story")).toHaveLength(3);
    expect(document.body.textContent).not.toContain("Smoke");
    expect(heading()).toBe("As a customer, I can log in");
    expect(story("As a customer, I can log in").getAttribute("aria-current")).toBe("true");
    expect(story("As a customer, I can log in").querySelector(".pqa-suite__story-count")?.textContent).toBe("1");
  });

  it("edits the selected story's suite on the right, without results or notes", () => {
    mount();
    expect(document.body.querySelector(".pqa-tests__category-index")?.textContent).toBe("Category 1");
    expect(document.body.querySelector(".pqa-tests__category-name")?.textContent).toBe("Happy path");
    expect(button("Edit")).toBeTruthy();
    expect(button("Delete test case Logs in with a saved password")).toBeTruthy();
    expect(document.body.querySelector("select")).toBeNull();
    expect(document.body.textContent).not.toContain("Add note");
    expect(document.body.textContent).not.toContain("Broke on Safari");
  });

  it("switches the pane when another story is picked", () => {
    mount();
    act(() => story("As a shopper, I can pay with a saved card").click());
    expect(heading()).toBe("As a shopper, I can pay with a saved card");
    expect(document.body.textContent).toContain("No categories yet.");
    expect(button("+ Add test case category")).toBeTruthy();
  });

  it("asks before Done closes it, and Keep editing stays", () => {
    const { onClose } = mount();
    act(() => button("Done").click());
    expect(document.body.querySelector('[role="alertdialog"]')?.textContent).toContain("Are you sure you're done?");
    expect(onClose).not.toHaveBeenCalled();

    act(() => button("Keep editing").click());
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    act(() => button("Done").click());
    act(() => button("Yes, I'm done").click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape in the confirmation keeps editing; Escape on the sheet asks first", () => {
    const { onClose } = mount();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    const confirm = document.body.querySelector('[role="alertdialog"]') as HTMLElement;
    expect(confirm).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      button("Yes, I'm done").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("warns that an open form's text is lost", () => {
    mount();
    act(() => button("+ Add test case category").click());
    act(() => button("Done").click());
    expect(document.body.querySelector('[role="alertdialog"]')?.textContent).toContain("has not been saved");
  });
});
