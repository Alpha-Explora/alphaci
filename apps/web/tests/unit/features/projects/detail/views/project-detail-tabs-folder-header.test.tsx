import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ProjectDetailTabs } from "../../../../../../src/features/projects/detail/views/project-detail-tabs";
import type { ProjectFolderViewModel } from "../../../../../../src/features/projects/detail/view-models/use-project-folder-view-model";
import type { AppRole, ProvisionedProject } from "../../../../../../src/shared/api/contracts";

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
  manageHref: "/workflows?group=ws-1&project=dp-1",
  project: { deliveryProjectId: "dp-1", name: "shop", href: "/workflows?group=ws-1&project=dp-1" },
  options: [
    { key: "proj-fe", projectId: "proj-fe", role: "frontend", roleLabel: "FRONTEND", label: "shop-fe", repoFullName: "Org/shop-fe", current: true, disabled: false },
    { key: "proj-be", projectId: "proj-be", role: "backend", roleLabel: "BACKEND", label: "shop-be", repoFullName: "Org/shop-be", current: false, disabled: false },
  ],
};

let root: Root | null = null;

function render(folder?: ProjectFolderViewModel, appRole?: AppRole): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<ProjectDetailTabs project={PROJECT} folder={folder} appRole={appRole} />));
  return container;
}

function unmount() {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
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
    expect(manage?.getAttribute("href")).toBe("/workflows?group=ws-1&project=dp-1");

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

/* The QA Team and Product owners judge the Project as one product: no
 * repository switch, and their five tabs in the title row. */
describe("ProjectDetailTabs header, product view", () => {
  it("puts the sections in a Project's title row and drops the switch", () => {
    for (const appRole of ["lead", "qa"] as const) {
      const container = render(FOLDER, appRole);
      const header = container.querySelector(".project-folder-header");
      expect(header?.classList.contains("project-detail-header--tabs")).toBe(true);
      expect(header?.querySelector('[data-tour="project-detail-tabs"] [role="tablist"]')).not.toBeNull();
      expect(container.querySelector('.project-sections > .project-tabs')).toBeNull();
      expect(container.querySelector('[role="radiogroup"]')).toBeNull();
      expect(container.querySelector("h1")?.textContent).toBe("shop");
      unmount();
    }
  });

  it("puts the sections beside a single repository's title too", () => {
    const container = render(undefined, "lead");
    const aside = container.querySelector(".project-detail-header--tabs .project-detail-header__aside");
    expect(aside?.querySelector(".project-status-badge")?.textContent).toBe("provisioned");
    expect(aside?.querySelector('[role="tablist"]')).not.toBeNull();
  });

  it("keeps the switch and the strip below the title for Developers and admins", () => {
    for (const appRole of ["member", "admin"] as const) {
      const container = render(FOLDER, appRole);
      expect(container.querySelector(".project-detail-header--tabs")).toBeNull();
      expect(container.querySelector('.project-sections[data-tour="project-detail-tabs"] > .project-tabs')).not.toBeNull();
      expect(container.querySelector('[role="radiogroup"]')).not.toBeNull();
      unmount();
    }
  });
});
