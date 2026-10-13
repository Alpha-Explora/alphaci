import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { SetupResultPanel } from "../../../../../../src/features/workflows/studio/views/setup-result-panel";
import { WorkflowCurrentTab } from "../../../../../../src/features/workflows/studio/views/workflow-current-tab";
import type { CreateProjectResult } from "../../../../../../src/shared/api/contracts";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("../../../../../../src/features/capabilities/current", () => ({
  useCapabilities: () => ({ envProvisioningEnabled: false }),
}));
jest.mock("../../../../../../src/features/workflows/studio/view-models/use-current-projects-view-model", () => ({
  GROUPS_LOAD_ERROR: "Could not load teams.",
  useCurrentProjectsViewModel: () => ({
    status: "ready",
    team: null,
    linkedFolderId: null,
    retry: jest.fn(),
  }),
}));

const RESULT: CreateProjectResult = {
  id: "proj 1",
  repoFullName: "acme/api",
  repoUrl: "https://github.com/acme/api",
  status: "provisioned",
  workflowPath: ".github/workflows/ci.yml",
  outputFileName: "ci.yml",
  githubCommitSha: "0123456789abcdef",
  githubCommitUrl: "https://github.com/acme/api/commit/0123456789abcdef",
  projectTypeId: "node",
  workflowRecipeId: "standard",
  branchesCreated: ["main", "uat", "develop"],
  secondaryRepoFullName: "acme/web",
  secondaryRepoUrl: "https://github.com/acme/web",
};

let root: Root | null = null;

beforeAll(() => {
  // framer-motion's whileInView observes visibility; jsdom has no observer.
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function mount(node: React.ReactNode): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(node));
  return container;
}

function hrefs(container: HTMLElement): string[] {
  return [...container.querySelectorAll("a")].map((anchor) => anchor.getAttribute("href") ?? "");
}

describe("project-created results stay inside ALPHACI", () => {
  it("the setup panel links the new project and its runs, and nothing on GitHub", () => {
    const container = mount(
      <SetupResultPanel setupResult={RESULT} existingRepoResult={null} onViewProject={jest.fn()} />,
    );

    expect(hrefs(container)).toEqual(["/projects/proj%201", "/projects/proj%201#pipeline"]);
    // Names and the commit stay readable, as text.
    expect(container.textContent).toContain("acme/api");
    expect(container.textContent).toContain("acme/web");
    expect(container.textContent).toContain("0123456789");
  });

  it("the current-projects banner links the new project and its runs, and nothing on GitHub", () => {
    const container = mount(
      <WorkflowCurrentTab
        latestResult={RESULT}
        loadingProjects={false}
        onOpenSetup={jest.fn()}
        canCreateProjects
        guest={false}
      />,
    );

    const banner = container.querySelector(".latest-result-banner") as HTMLElement;
    expect(banner).not.toBeNull();
    expect(hrefs(banner)).toEqual(["/projects/proj%201", "/projects/proj%201#pipeline"]);
    expect(container.querySelector('a[href*="github.com"]')).toBeNull();
  });
});
