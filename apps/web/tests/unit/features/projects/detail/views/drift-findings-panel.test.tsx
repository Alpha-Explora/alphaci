import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { DriftFindingsPanel } from "../../../../../../src/features/projects/detail/views/drift-findings-panel";
import type {
  AppRole,
  ProjectDriftResponse,
} from "../../../../../../src/shared/api/contracts";

const RESPONSE = {
  findings: [
    {
      id: "f1",
      projectId: "p1",
      targetId: null,
      source: "github_live",
      severity: "error",
      code: "branch_protection_missing",
      message: "main is not protected",
      details: {},
      status: "open",
      detectedAt: "2026-09-30T00:00:00.000Z",
      resolvedAt: null,
    },
  ],
} as unknown as ProjectDriftResponse;

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(appRole: AppRole) {
  act(() => {
    root.render(
      <DriftFindingsPanel
        appRole={appRole}
        onRun={jest.fn()}
        onRepair={jest.fn().mockResolvedValue("ok")}
        repairEnabled
        response={RESPONSE}
        running={false}
        workflowUpdatePrEnabled={false}
      />,
    );
  });
}

function buttonTexts(): string[] {
  return Array.from(container.querySelectorAll("button")).map((b) => b.textContent ?? "");
}

describe("DriftFindingsPanel branch protection repair", () => {
  it("shows the note instead of the button for a member", () => {
    render("member");
    expect(buttonTexts()).not.toContain("Repair branch protection");
    expect(container.textContent).toContain("A Team lead or admin can repair this.");
    expect(container.textContent).toContain("Live check");
  });

  it("shows the button for a lead", () => {
    render("lead");
    expect(buttonTexts()).toContain("Repair branch protection");
    expect(container.textContent).not.toContain("A Team lead or admin can repair this.");
  });
});
