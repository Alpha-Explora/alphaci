import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ProjectDetailTabs } from "../../../../../../src/features/projects/detail/views/project-detail-tabs";
import type { ProjectFolderViewModel } from "../../../../../../src/features/projects/detail/view-models/use-project-folder-view-model";
import type { AppRole, ProvisionedProject } from "../../../../../../src/shared/api/contracts";

/* QA Studio and PO Studio portal their preview controls into a slot in the
 * page's tab row. The studio itself is covered in qa-studio-views; here it is
 * a stand-in that does the same with the slot it is handed, so these tests
 * are about WHERE the page puts the slot, per role and tab. */

let mockTab = "qa";
let mockVisibleTabs = ["overview", "checklists", "qa", "audit", "settings"];
const studioProps: Array<{ studio?: string; toolbarSlot?: HTMLElement | null }> = [];

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

jest.mock("../../../../../../src/features/projects/detail/view-models/use-project-detail-tabs-view-model", () => ({
  useProjectDetailTabsViewModel: () => ({
    tab: mockTab,
    setTab: jest.fn(),
    visibleTabs: mockVisibleTabs,
    appRole: "qa",
    status: "ready",
    error: null,
  }),
}));

jest.mock("../../../../../../src/features/checklists/studio", () => {
  const { createPortal } = jest.requireActual<typeof import("react-dom")>("react-dom");
  return {
    QaStudioPanel: (props: { studio?: string; toolbarSlot?: HTMLElement | null }) => {
      studioProps.push(props);
      const toolbar = (
        <div className="qa-toolbar" data-placement="tab-row">
          {props.studio ?? "qa"} controls
        </div>
      );
      return <div role="tabpanel">{props.toolbarSlot ? createPortal(toolbar, props.toolbarSlot) : null}</div>;
    },
  };
});

jest.mock("../../../../../../src/features/projects/detail/views/overview-tab", () => ({
  OverviewTab: () => <p>overview panel</p>,
}));

jest.mock("../../../../../../src/features/projects/detail/views/checklists-tab-panel", () => ({
  ChecklistsTabPanel: () => <p>checklists panel</p>,
}));

jest.mock("../../../../../../src/features/projects/detail/views/hosting-tab", () => ({
  HostingTab: () => <p>hosting panel</p>,
}));

jest.mock("../../../../../../src/features/projects/detail/views/audit-tab", () => ({
  AuditTab: () => <p>audit panel</p>,
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
  project: { deliveryProjectId: "dp-1", name: "shop", href: "/workflows?group=ws-1&project=dp-1" },
  options: [
    { key: "proj-fe", projectId: "proj-fe", role: "frontend", roleLabel: "FRONTEND", label: "shop-fe", repoFullName: "Org/shop-fe", current: true, disabled: false },
    { key: "proj-be", projectId: "proj-be", role: "backend", roleLabel: "BACKEND", label: "shop-be", repoFullName: "Org/shop-be", current: false, disabled: false },
  ],
};

let root: Root | null = null;

/** `null`: a repository in no multi-repository Project (no folder header, no switch). */
function render(appRole: AppRole, folder: ProjectFolderViewModel | null = FOLDER): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<ProjectDetailTabs project={PROJECT} folder={folder ?? undefined} appRole={appRole} />));
  return container;
}

function unmount() {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
}

afterEach(() => {
  if (root) unmount();
  mockTab = "qa";
  mockVisibleTabs = ["overview", "checklists", "qa", "audit", "settings"];
  studioProps.length = 0;
});

describe("Studio controls in the tab row, product view", () => {
  it.each([
    ["qa", "qa", ["overview", "checklists", "qa", "audit", "settings"]],
    ["lead", "po", ["overview", "checklists", "po", "audit", "settings"]],
  ] as const)("puts a %s's %s controls at the left of the title row's tabs", (role, tab, tabs) => {
    mockTab = tab;
    mockVisibleTabs = [...tabs];
    for (const folder of [FOLDER, null]) {
      const container = render(role, folder);
      const bar = container.querySelector(".project-detail-header--tabs .project-tabs-bar");
      expect(bar).not.toBeNull();
      const [controls, tabsCell] = [...(bar?.children ?? [])];
      // Controls first (left, and first in keyboard order), then the tabs.
      expect(controls?.classList.contains("project-studio-controls")).toBe(true);
      expect(tabsCell?.matches('.project-tabs-bar__tabs[data-tour="project-detail-tabs"]')).toBe(true);
      expect(tabsCell?.querySelector('[role="tablist"]')).not.toBeNull();
      // The studio drew its toolbar into the slot: no box of the page's own around it.
      expect(controls?.querySelector(".qa-toolbar")?.textContent).toBe(`${tab} controls`);
      expect(controls?.children).toHaveLength(1);
      // No repository switch for the product view, and nothing in the sections.
      expect(container.querySelector('[role="radiogroup"]')).toBeNull();
      expect(container.querySelector(".project-sections > .project-studio-controls")).toBeNull();
      unmount();
    }
  });

  it.each(["overview", "checklists", "audit"])("renders no controls slot on %s", (tab) => {
    mockTab = tab;
    for (const role of ["qa", "lead"] as const) {
      const container = render(role);
      expect(container.querySelector(".project-studio-controls")).toBeNull();
      expect(container.querySelector(".qa-toolbar")).toBeNull();
      // The tabs are still in the title row, as before.
      expect(container.querySelector('.project-tabs-bar [data-tour="project-detail-tabs"] [role="tablist"]')).not.toBeNull();
      unmount();
    }
  });

  it("hands the studio the slot once it is mounted", () => {
    render("qa");
    expect(studioProps.at(-1)?.toolbarSlot).toBeInstanceOf(HTMLElement);
    expect(studioProps.at(-1)?.toolbarSlot?.classList.contains("project-studio-controls")).toBe(true);
  });
});

describe("Studio controls for an admin", () => {
  const ADMIN_TABS = [
    "overview", "code", "pulls", "checklists", "runs", "workflow", "hosting", "qa", "po", "audit", "settings",
  ];

  it.each(["qa", "po"])("puts the %s controls on the line under the tab row, leaving the switch alone", (tab) => {
    mockTab = tab;
    mockVisibleTabs = ADMIN_TABS;
    const container = render("admin");
    const row = container.querySelector('.project-sections[data-tour="project-detail-tabs"] > .project-tabs-row');
    expect(row?.querySelector('[role="radiogroup"]')).not.toBeNull();
    const controls = row?.nextElementSibling;
    expect(controls?.classList.contains("project-studio-controls")).toBe(true);
    expect(controls?.querySelector(".qa-toolbar")?.textContent).toBe(`${tab} controls`);
    // Nothing in the row itself, nor in the header.
    expect(row?.querySelector(".qa-toolbar")).toBeNull();
    expect(container.querySelector(".project-detail-header .project-studio-controls")).toBeNull();
    expect(controls?.nextElementSibling?.classList.contains("project-sections__body")).toBe(true);
  });

  it("puts them under the plain strip when there is no repository switch", () => {
    mockVisibleTabs = ADMIN_TABS;
    const container = render("admin", null);
    expect(container.querySelector(".project-tabs-row")).toBeNull();
    expect(container.querySelector(".project-sections > .project-tabs + .project-studio-controls .qa-toolbar")).not.toBeNull();
  });

  it("renders no controls slot off the studio tabs", () => {
    mockTab = "hosting";
    mockVisibleTabs = ADMIN_TABS;
    const container = render("admin");
    expect(container.querySelector(".project-studio-controls")).toBeNull();
  });
});
