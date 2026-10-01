import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { qaRunsRepository } from "../../../../../../src/features/checklists/data/qa-runs-repository";
import { OverviewTab } from "../../../../../../src/features/projects/detail/views/overview-tab";
import type { ProjectDetailTabsViewModel } from "../../../../../../src/features/projects/detail/view-models/use-project-detail-tabs-view-model";
import type { AppRole, ProvisionedProject } from "../../../../../../src/shared/api/contracts";
import { readyWire } from "../../../checklists/qa-promotion-fixtures";

jest.mock("../../../../../../src/features/checklists/data/qa-runs-repository", () => ({
  qaRunsRepository: { promotion: jest.fn(), mergePromotion: jest.fn() },
}));
jest.mock("../../../../../../src/features/checklists/returned", () => ({
  MyQaItemsCard: () => null,
}));
jest.mock("../../../../../../src/features/projects/previews", () => ({
  ProductionDeploymentPanel: () => null,
}));

const runs = qaRunsRepository as jest.Mocked<typeof qaRunsRepository>;

const PROJECT = {
  id: "p1",
  repoFullName: "acme/shop",
  serviceName: "shop",
  workspaceId: "ws-1",
  status: "provisioned",
  workflowPath: ".github/workflows/ci.yml",
} as unknown as ProvisionedProject;

function vmFor(appRole: AppRole, qaChecklistsEnabled = true): ProjectDetailTabsViewModel {
  return {
    appRole,
    qaChecklistsEnabled,
    previewDeploymentsEnabled: false,
    highlightMyQaItems: false,
    overview: {
      hierarchyRepositoryId: "repo-1",
      health: { checks: [] },
      workflow: { path: ".github/workflows/ci.yml" },
      ciAuth: { status: "active" },
      deploymentTargets: { count: 0 },
    },
    workflowFiles: [],
    syncSnapshot: null,
    syncAvailable: false,
    syncingProjectId: null,
    syncMessage: null,
    driftDetectionEnabled: false,
    openTargetLogs: jest.fn(),
  } as unknown as ProjectDetailTabsViewModel;
}

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  window.localStorage.clear();
  jest.clearAllMocks();
});

async function render(appRole: AppRole, qaChecklistsEnabled = true): Promise<HTMLElement> {
  runs.promotion.mockResolvedValue(readyWire() as never);
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<OverviewTab project={PROJECT} vm={vmFor(appRole, qaChecklistsEnabled)} />);
  });
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  return container;
}

function manageAccess(container: HTMLElement): Element | undefined {
  return [...container.querySelectorAll("a")].find((a) => a.textContent === "Manage access");
}

describe("Overview Manage access", () => {
  it("is shown to Team leads and Admins", async () => {
    expect(manageAccess(await render("lead"))).toBeDefined();
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";
    expect(manageAccess(await render("admin"))).toBeDefined();
  });

  it("is hidden from QA Team and Developers", async () => {
    expect(manageAccess(await render("qa"))).toBeUndefined();
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";
    expect(manageAccess(await render("member"))).toBeUndefined();
  });
});

describe("Overview Ready for production card", () => {
  it("shows a Developer a read-only card: no merge button, no Studio link", async () => {
    const container = await render("member");
    expect(runs.promotion).toHaveBeenCalledWith("p1");
    expect(container.querySelector("section[aria-label='Production readiness']")).not.toBeNull();
    const buttons = [...container.querySelectorAll("button")].map((b) => b.textContent ?? "");
    expect(buttons.some((text) => text.includes("Merge to main"))).toBe(false);
    expect(container.querySelector("a[href*='qa']")).toBeNull();
  });

  it("leaves Leads, Admins and QA Team to QA Studio", async () => {
    for (const role of ["lead", "admin", "qa"] as const) {
      const container = await render(role);
      expect(container.querySelector("section[aria-label='Production readiness']")).toBeNull();
      act(() => root?.unmount());
      root = null;
      document.body.innerHTML = "";
    }
    expect(runs.promotion).not.toHaveBeenCalled();
  });

  it("is hidden when the QA capability is off", async () => {
    const container = await render("member", false);
    expect(container.querySelector("section[aria-label='Production readiness']")).toBeNull();
    expect(runs.promotion).not.toHaveBeenCalled();
  });
});
