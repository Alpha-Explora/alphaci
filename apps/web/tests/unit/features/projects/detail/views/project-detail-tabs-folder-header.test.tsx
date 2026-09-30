import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ProjectDetailTabs } from "../../../../../../src/features/projects/detail/views/project-detail-tabs";
import type { ProjectFolderViewModel } from "../../../../../../src/features/projects/detail/view-models/use-project-folder-view-model";
import type { ProvisionedProject } from "../../../../../../src/shared/api/contracts";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

jest.mock("../../../../../../src/features/projects/detail/view-models/use-project-detail-tabs-view-model", () => ({
  useProjectDetailTabsViewModel: () => ({
    tab: "hosting",
    setTab: jest.fn(),
    visibleTabs: ["overview", "hosting", "settings"],
    status: "ready",
    error: null,
  }),
}));

jest.mock("../../../../../../src/features/projects/detail/views/hosting-tab", () => ({
  HostingTab: () => <p>hosting panel</p>,
}));

const PROJECT = {
  id: "proj-fe",
  repoFullName: "Org/shop-fe",
  serviceName: "shop-frontend",
  status: "provisioned",
  workflowFiles: [],
} as unknown as ProvisionedProject;

const FOLDER: ProjectFolderViewModel = {
  status: "ready",
  projectName: "shop",
  manageHref: "/teams?workspace=ws-1&section=projects&project=dp-1",
  options: [
    { key: "proj-fe", projectId: "proj-fe", role: "frontend", roleLabel: "FRONTEND", label: "shop-fe", repoFullName: "Org/shop-fe", current: true, disabled: false },
    { key: "proj-be", projectId: "proj-be", role: "backend", roleLabel: "BACKEND", label: "shop-be", repoFullName: "Org/shop-be", current: false, disabled: false },
  ],
};

let root: Root | null = null;

function render(folder?: ProjectFolderViewModel): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<ProjectDetailTabs project={PROJECT} folder={folder} />));
  return container;
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

describe("ProjectDetailTabs header", () => {
  it("titles a multi-repository Project and switches on the current tab", () => {
    const container = render(FOLDER);
    expect(container.querySelector("h1")?.textContent).toBe("shop");
    const repo = container.querySelector(".project-folder-header__repo");
    expect(repo?.textContent).toContain("Org/shop-fe");
    expect(repo?.querySelector(".project-status-badge")?.textContent).toBe("provisioned");
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull();

    const manage = [...container.querySelectorAll("a")].find((el) => el.textContent?.includes("Manage project"));
    expect(manage?.getAttribute("href")).toBe("/teams?workspace=ws-1&section=projects&project=dp-1");

    const backend = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')][1];
    act(() => backend.click());
    expect(push).toHaveBeenCalledWith("/projects/proj-be#hosting");
  });

  it("omits Manage project when the folder cannot be named on the Teams page", () => {
    const container = render({ ...FOLDER, manageHref: null });
    expect(container.textContent).not.toContain("Manage project");
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull();
  });

  it("renders the header exactly as before without a multi-repository Project", () => {
    for (const folder of [undefined, { status: "unavailable", projectName: null, options: [], manageHref: null } as ProjectFolderViewModel]) {
      const container = render(folder);
      expect(container.querySelector("h1")?.textContent).toBe("Org/shop-fe");
      expect(container.querySelector(".project-detail-header p")?.textContent).toBe("shop-frontend");
      expect(container.querySelector('[role="radiogroup"]')).toBeNull();
      expect(container.textContent).not.toContain("Manage project");
      act(() => root?.unmount());
      root = null;
    }
  });
});
