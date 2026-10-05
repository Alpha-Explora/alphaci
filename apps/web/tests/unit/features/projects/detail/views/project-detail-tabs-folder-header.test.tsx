import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ProjectDetailTabs } from "../../../../../../src/features/projects/detail/views/project-detail-tabs";
import type { ProjectFolderViewModel } from "../../../../../../src/features/projects/detail/view-models/use-project-folder-view-model";
import type { AppRole, ProvisionedProject } from "../../../../../../src/shared/api/contracts";

const push = jest.fn();
let mockTab = "overview";
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

jest.mock("../../../../../../src/features/projects/detail/view-models/use-project-detail-tabs-view-model", () => ({
  useProjectDetailTabsViewModel: () => ({
    tab: mockTab,
    setTab: jest.fn(),
    visibleTabs: ["overview", "hosting", "settings"],
    status: "ready",
    error: null,
  }),
}));

jest.mock("../../../../../../src/features/projects/detail/views/hosting-tab", () => ({
  HostingTab: () => <p>hosting panel</p>,
}));

jest.mock("../../../../../../src/features/projects/detail/views/overview-tab", () => ({
  OverviewTab: () => <p>overview panel</p>,
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
  mockTab = "overview";
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
    expect(push).toHaveBeenCalledWith("/projects/proj-be#overview");
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
      expect(container.querySelector(".project-detail-header__identity p")?.textContent).toBe("shop-frontendprovisioned");
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
      // Their Checklists tab carries the Project's QA: nothing links away.
      expect(container.textContent).not.toContain("Manage project");
      unmount();
    }
  });

  it("puts the sections above a single repository's title too", () => {
    const container = render(undefined, "lead");
    const aside = container.querySelector(".project-detail-header--tabs .project-detail-header__aside");
    expect(aside?.querySelector('[role="tablist"]')).not.toBeNull();
    // The status is the identity's, so it goes with it off Overview.
    expect(container.querySelector(".project-detail-header__identity .project-status-badge")?.textContent).toBe("provisioned");
  });

  it("keeps the switch and the strip below the title for Developers and admins", () => {
    for (const appRole of ["member", "admin"] as const) {
      const container = render(FOLDER, appRole);
      expect(container.querySelector(".project-detail-header--tabs")).toBeNull();
      expect(container.querySelector('.project-sections[data-tour="project-detail-tabs"] > .project-tabs-row')).not.toBeNull();
      expect(container.querySelector('[role="radiogroup"]')).not.toBeNull();
      unmount();
    }
  });

  it("without a switch the strip stands alone, as before", () => {
    for (const folder of [undefined, { ...FOLDER, projectName: null }]) {
      const container = render(folder, "member");
      expect(container.querySelector(".project-tabs-row")).toBeNull();
      expect(container.querySelector(".project-sections > .project-tabs")).not.toBeNull();
      unmount();
    }
  });
});

/* The repository switch ends the tab row: after the tabs, right-aligned, and a
 * sibling of the tablist (a tablist holds only tabs, and the switch must not
 * scroll away with them). */
describe("ProjectDetailTabs tab row", () => {
  it("puts the switch after the tabs, outside the tablist and its scroller", () => {
    for (const appRole of ["member", "admin"] as const) {
      const container = render(FOLDER, appRole);
      const row = container.querySelector(".project-tabs-row");
      expect(row).not.toBeNull();
      const [strip, trailing] = [...(row?.children ?? [])];
      expect(strip?.classList.contains("project-tabs")).toBe(true);
      expect(trailing?.classList.contains("project-tabs-row__trailing")).toBe(true);
      expect(strip?.nextElementSibling).toBe(trailing);

      const tablist = row?.querySelector('[role="tablist"]');
      expect(tablist).not.toBeNull();
      const group = row?.querySelector('[role="radiogroup"]');
      expect(group).not.toBeNull();
      expect(trailing?.contains(group ?? null)).toBe(true);
      expect(tablist?.contains(group ?? null)).toBe(false);
      expect(strip?.contains(group ?? null)).toBe(false);
      // The tablist holds only tabs (groups are presentational wrappers).
      const owned = [...(tablist?.querySelectorAll("button") ?? [])];
      expect(owned.length).toBeGreaterThan(0);
      expect(owned.every((button) => button.getAttribute("role") === "tab")).toBe(true);
      unmount();
    }
  });

  it("leaves Manage project alone in the header aside, the switch gone from it", () => {
    const container = render(FOLDER, "member");
    const aside = container.querySelector(".project-folder-header__aside");
    expect(aside?.querySelector('[role="radiogroup"]')).toBeNull();
    expect(aside?.children).toHaveLength(1);
    expect(aside?.textContent).toContain("Manage project");
  });

  it("renders no empty aside when there is no Manage project link", () => {
    const container = render({ ...FOLDER, manageHref: null }, "member");
    expect(container.querySelector(".project-folder-header__aside")).toBeNull();
    expect(container.querySelector(".project-tabs-row [role=\"radiogroup\"]")).not.toBeNull();
  });

  it("keeps the arrow keys and click opening a sibling, now from the tab row", () => {
    const container = render(FOLDER, "member");
    const radios = [...container.querySelectorAll<HTMLButtonElement>('.project-tabs-row [role="radio"]')];
    expect(radios.map((radio) => radio.getAttribute("aria-checked"))).toEqual(["true", "false"]);
    act(() => radios[1]?.click());
    expect(push).toHaveBeenCalledWith("/projects/proj-be#overview");
  });

  it("leaves the product view's tabs in the title row, with no tab row wrapper", () => {
    for (const appRole of ["qa", "lead"] as const) {
      const container = render(FOLDER, appRole);
      expect(container.querySelector(".project-tabs-row")).toBeNull();
      expect(container.querySelector(".project-folder-header .project-tabs")).not.toBeNull();
      unmount();
    }
  });
});

/* Overview puts the identity and Clone side by side under the aside, for
 * every role, so Production Deployment is the panel's first row. Every other
 * tab shows the aside alone; the title stays the h1 for screen readers. */
describe("ProjectDetailTabs header, Overview summary", () => {
  it("puts the identity and Clone under the aside, for every role and header", () => {
    for (const appRole of ["qa", "lead", "member", "admin"] as const) {
      for (const folder of [FOLDER, undefined]) {
        const container = render(folder, appRole);
        const header = container.querySelector(".project-detail-header");
        expect(header?.classList.contains("project-detail-header--summary")).toBe(true);
        expect(header?.querySelector(":scope > .project-detail-header__identity, :scope > .project-folder-header__identity")).not.toBeNull();
        expect(header?.querySelector(":scope > .project-detail-header__clone .clone-card__input")).not.toBeNull();
        expect(container.querySelector(".project-detail-header__sr-title")).toBeNull();
        expect(container.querySelector(".project-sections .clone-card")).toBeNull();
        unmount();
      }
    }
  });

  it("keeps the product view's sections in the header, above the summary", () => {
    const container = render(FOLDER, "qa");
    const header = container.querySelector(".project-folder-header");
    expect(header?.classList.contains("project-detail-header--tabs")).toBe(true);
    expect(header?.firstElementChild?.matches(".project-folder-header__aside")).toBe(true);
    expect(header?.querySelector('.project-folder-header__aside [role="tablist"]')).not.toBeNull();
  });

  it("hides the identity and Clone on every other tab, keeping the aside", () => {
    mockTab = "hosting";
    for (const appRole of ["qa", "lead", "member", "admin"] as const) {
      for (const folder of [FOLDER, undefined]) {
        const container = render(folder, appRole);
        expect(container.querySelector(".project-detail-header--summary")).toBeNull();
        expect(container.querySelector(".project-folder-header__identity, .project-detail-header__identity")).toBeNull();
        expect(container.querySelector(".project-status-badge")).toBeNull();
        expect(container.querySelector(".clone-card")).toBeNull();
        const title = container.querySelector("h1");
        expect(title?.classList.contains("project-detail-header__sr-title")).toBe(true);
        expect(title?.textContent).toBe(folder ? "shop" : "Org/shop-fe");
        if (folder && (appRole === "member" || appRole === "admin")) {
          expect(container.querySelector('.project-detail-header--bare [role="radiogroup"]')).toBeNull();
          expect(container.querySelector('.project-sections .project-tabs-row [role="radiogroup"]')).not.toBeNull();
        }
        if (appRole === "qa" || appRole === "lead") {
          expect(container.querySelector('.project-detail-header--bare [role="tablist"]')).not.toBeNull();
        }
        unmount();
      }
    }
  });
});
