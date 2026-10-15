import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { getProjectBrowserTests } from "../../../../../../src/features/projects/detail/data/project-browser-tests-api";
import type { ProvisionedProject } from "../../../../../../src/features/projects";
import type { ProjectDetailTabsViewModel } from "../../../../../../src/features/projects/detail/view-models/use-project-detail-tabs-view-model";
import { WorkflowTab } from "../../../../../../src/features/projects/detail/views/workflow-tab";

jest.mock("../../../../../../src/features/projects/detail/data/project-browser-tests-api", () => ({
  getProjectBrowserTests: jest.fn(),
  addProjectBrowserTests: jest.fn(),
}));

const mockedStatus = getProjectBrowserTests as jest.MockedFunction<typeof getProjectBrowserTests>;

const PROJECT = { id: "p1" } as ProvisionedProject;
const VM = {
  appRole: "member",
  visibleTabs: ["overview", "pipeline", "pulls"],
  openPullRequest: jest.fn(),
  workflowUpdateAccess: "open",
  workflowSettingsPreviewEnabled: false,
  overview: null,
  deploymentTargets: [],
  workflow: null,
  workflowUpdatePrEnabled: false,
  workflowFiles: [],
} as unknown as ProjectDetailTabsViewModel;

let root: Root | null = null;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host.remove();
  jest.clearAllMocks();
});

async function render() {
  await act(async () => {
    root = createRoot(host);
    root.render(<WorkflowTab project={PROJECT} vm={VM} />);
  });
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("Pipeline configuration — Browser tests", () => {
  it("is where the browser test set-up lives: what is missing and Add browser tests", async () => {
    mockedStatus.mockResolvedValue({
      installed: false,
      branch: "dev",
      missingFiles: ["playwright.config.ts", "tests/e2e/pages.e2e-spec.ts"],
      presentFiles: [],
      hasLockfile: true,
      playwrightVersion: null,
      frontend: true,
      canAdd: true,
      reason: null,
      ownTests: { count: 1, paths: ["e2e/intake.spec.ts"] },
    });
    await render();
    expect(mockedStatus).toHaveBeenCalledWith("p1");
    expect(host.querySelector("[data-browser-tests] h3")?.textContent).toBe("Browser tests");
    expect(host.textContent).toContain("Your 1 browser test file on dev run in the Verify stage.");
    expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Add browser tests")).toBe(true);
  });

  it("shows nothing for a repository that is not a frontend", async () => {
    mockedStatus.mockResolvedValue({
      installed: false,
      branch: "dev",
      missingFiles: [],
      presentFiles: [],
      hasLockfile: true,
      playwrightVersion: null,
      frontend: false,
      canAdd: false,
      reason: "This repository does not look like a frontend project.",
      ownTests: null,
    });
    await render();
    expect(host.querySelector("[data-browser-tests]")).toBeNull();
  });
});
