import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import type { QaScope } from "../../../../../../src/features/checklists/model/qa-scope";
import type { ProjectDetailTabsViewModel } from "../../../../../../src/features/projects/detail/view-models/use-project-detail-tabs-view-model";
import { ChecklistsTabPanel } from "../../../../../../src/features/projects/detail/views/checklists-tab-panel";
import type { ProvisionedProject } from "../../../../../../src/shared/api/contracts";

jest.mock("../../../../../../src/features/checklists/project", () => ({
  ProjectChecklistsPanel: ({ myItems }: { myItems?: React.ReactNode }) => <div data-testid="panel">{myItems}</div>,
}));
jest.mock("../../../../../../src/features/checklists/requirements", () => ({
  ProjectQaWorkspace: (props: { deliveryProjectId: string; appRole: string; enabled?: boolean; itemsFallback?: React.ReactNode }) => (
    <div
      data-testid="qa-workspace"
      data-project={props.deliveryProjectId}
      data-role={props.appRole}
      data-enabled={String(props.enabled)}
    >
      {props.itemsFallback}
    </div>
  ),
}));
jest.mock("../../../../../../src/features/checklists/returned", () => ({
  MyQaItemsCard: (props: { projectId: string; enabled: boolean; projectListElsewhere?: boolean }) => (
    <p
      data-testid="my-items"
      data-enabled={String(props.enabled)}
      data-elsewhere={String(Boolean(props.projectListElsewhere))}
    >
      {props.projectId}
    </p>
  ),
}));

const PROJECT = { id: "p1", workspaceId: "ws-1" } as ProvisionedProject;
const VM = {
  appRole: "member",
  qaChecklistsEnabled: true,
  visibleTabs: ["overview", "checklists", "history"],
  setTab: jest.fn(),
} as unknown as ProjectDetailTabsViewModel;

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function render(qaScope: QaScope, vm: ProjectDetailTabsViewModel = VM): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<ChecklistsTabPanel project={PROJECT} vm={vm} qaScope={qaScope} />);
  });
  return container;
}

const PROJECT_SCOPE: QaScope = { kind: "project", deliveryProjectId: "dp-1", projectName: "Checkout", projectHref: null };

/* The Overview shows only a summary of "My QA items"; its "Open checklist"
 * lands here, so a repository with no Project carries the full list here. */
describe("Checklists tab My QA items", () => {
  it("carries the full list for a repository with no Project", () => {
    const item = render({ kind: "repository" }).querySelector("[data-testid='my-items']");
    expect(item?.textContent).toBe("p1");
    expect(item?.getAttribute("data-enabled")).toBe("true");
    expect(item?.getAttribute("data-elsewhere")).toBe("false");
  });

  /* The card itself then draws nothing unless the server has no
   * Project-wide list (my-qa-items-card covers that fallback). */
  it("leaves it to the Project workspace for a repository in a Project", () => {
    const container = render(PROJECT_SCOPE);
    expect(container.querySelector("[data-testid='qa-workspace']")).not.toBeNull();
    expect(container.querySelector("[data-testid='panel']")).toBeNull();
  });

  it("hands the workspace the per-repository card as its older-backend fallback", () => {
    const vm = { ...VM, appRole: "member", qaChecklistsEnabled: true } as unknown as ProjectDetailTabsViewModel;
    const item = render(PROJECT_SCOPE, vm).querySelector("[data-testid='qa-workspace'] [data-testid='my-items']");
    expect(item?.textContent).toBe("p1");
    expect(item?.getAttribute("data-elsewhere")).toBe("false");
  });

  it("keeps the per-repository panel while the Project is still being read", () => {
    const container = render({ kind: "pending" });
    expect(container.querySelector("[data-testid='panel']")).not.toBeNull();
    expect(container.querySelector("[data-testid='qa-workspace']")).toBeNull();
  });
});

/* The QA Team and Product owners judge the Project: their tab is the
 * Project's QA workspace itself, not a pointer to the Projects page. */
describe("Checklists tab, Project workspace", () => {
  it("embeds the Project's QA workspace inside the strip's tabpanel, for every role", () => {
    for (const appRole of ["lead", "qa", "member", "admin"]) {
      const vm = { ...VM, appRole, qaChecklistsEnabled: true } as unknown as ProjectDetailTabsViewModel;
      const container = render(PROJECT_SCOPE, vm);
      const panel = container.querySelector("#project-detail-panel-checklists");
      expect(panel?.getAttribute("role")).toBe("tabpanel");
      expect(panel?.getAttribute("aria-labelledby")).toBe("project-detail-tab-checklists");
      const workspace = panel?.querySelector("[data-testid='qa-workspace']");
      expect(workspace?.getAttribute("data-project")).toBe("dp-1");
      expect(workspace?.getAttribute("data-role")).toBe(appRole);
      expect(container.querySelector("[data-testid='panel']")).toBeNull();
      act(() => root?.unmount());
      root = null;
    }
  });

  // Not shown here: which view the workspace opens on is its own rule (checklistViewFor).
  it("hands the workspace the viewer's role, so it opens on that role's one view", () => {
    const vm = { ...VM, appRole: "member", qaChecklistsEnabled: true } as unknown as ProjectDetailTabsViewModel;
    expect(render(PROJECT_SCOPE, vm).querySelector("[data-testid='qa-workspace']")?.getAttribute("data-role")).toBe("member");
  });

  it("keeps the repository's own screens with no Project, for every role", () => {
    for (const appRole of ["lead", "qa", "member", "admin"]) {
      const vm = { ...VM, appRole, qaChecklistsEnabled: true } as unknown as ProjectDetailTabsViewModel;
      const container = render({ kind: "repository" }, vm);
      expect(container.querySelector("[data-testid='qa-workspace']")).toBeNull();
      expect(container.querySelector("[data-testid='panel']")).not.toBeNull();
      act(() => root?.unmount());
      root = null;
    }
  });
});
