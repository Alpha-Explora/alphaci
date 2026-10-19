import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { SetupResultPanel } from "../../../../../../src/features/workflows/studio/views/setup-result-panel";
import type { CreateProjectResult } from "../../../../../../src/shared/api/contracts";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("../../../../../../src/features/capabilities/current", () => ({
  useCapabilities: () => ({ envProvisioningEnabled: false }),
}));

const PAIR: CreateProjectResult = {
  id: "be-1",
  repoFullName: "acme/orders-be",
  repoUrl: "https://github.com/acme/orders-be",
  status: "provisioned",
  workflowPath: ".github/workflows/ci.yml",
  outputFileName: "ci.yml",
  githubCommitSha: "0123456789abcdef",
  githubCommitUrl: null,
  projectTypeId: "node",
  workflowRecipeId: "standard",
  branchesCreated: ["main", "uat", "dev"],
  secondaryRepoFullName: "acme/orders-fe",
  secondaryRepoUrl: "https://github.com/acme/orders-fe",
  secondaryProjectId: "fe-1",
};

let root: Root | null = null;

beforeAll(() => {
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

function mount(result: CreateProjectResult): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root!.render(
      <SetupResultPanel setupResult={result} existingRepoResult={null} onViewProject={jest.fn()} />,
    ),
  );
  return container;
}

function retryLinks(container: HTMLElement): Array<[string, string]> {
  return [...container.querySelectorAll("a")]
    .filter((anchor) => anchor.textContent?.includes("retry the assignment"))
    .map((anchor) => [anchor.getAttribute("href") ?? "", anchor.textContent ?? ""]);
}

describe("two-repository create results", () => {
  it("retries a frontend host assignment on the frontend project", () => {
    const container = mount({
      ...PAIR,
      hostAssignments: [
        { environmentId: "be-dev", status: "assigned", projectId: "be-1", slot: "backend" },
        {
          environmentId: "fe-dev",
          status: "failed",
          message: "Host is offline.",
          projectId: "fe-1",
          slot: "frontend",
        },
      ],
    });

    expect(container.textContent).toContain("Host is offline.");
    expect(retryLinks(container)).toEqual([
      ["/projects/fe-1", "Open the frontend repository’s Hosting panel to retry the assignment."],
    ]);
  });

  it("gives one retry link per repository when both have failures", () => {
    const container = mount({
      ...PAIR,
      hostAssignments: [
        { environmentId: "be-dev", status: "failed", message: "a", projectId: "be-1", slot: "backend" },
        { environmentId: "be-uat", status: "failed", message: "b", projectId: "be-1", slot: "backend" },
        { environmentId: "fe-dev", status: "failed", message: "c", projectId: "fe-1", slot: "frontend" },
      ],
    });

    expect(retryLinks(container).map(([href]) => href)).toEqual(["/projects/be-1", "/projects/fe-1"]);
  });

  it("keeps the single project link when entries carry no project", () => {
    const container = mount({
      ...PAIR,
      secondaryProjectId: undefined,
      hostAssignments: [{ environmentId: "dev", status: "failed", message: "x" }],
    });

    expect(retryLinks(container)).toEqual([
      ["/projects/be-1", "Open the project’s Hosting panel to retry the assignment."],
    ]);
  });

  it("says so when the frontend repository was not created", () => {
    const container = mount({
      ...PAIR,
      secondaryRepoFullName: undefined,
      secondaryRepoUrl: undefined,
      secondaryProjectId: undefined,
      secondaryRepoError: "GitHub refused the repository name.",
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("The frontend repository wasn’t created.");
    expect(alert?.textContent).toContain("GitHub refused the repository name.");
    expect(container.textContent).not.toContain("Secondary repo:");
  });
});
