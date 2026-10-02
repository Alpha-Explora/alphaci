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
const summaryProps: Array<Record<string, unknown>> = [];
jest.mock("../../../../../../src/features/checklists/returned", () => ({
  MyQaItemsSummary: (props: Record<string, unknown>) => {
    summaryProps.push(props);
    return <p data-testid="summary-stub">summary</p>;
  },
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

const setTab = jest.fn();

function vmFor(appRole: AppRole, qaChecklistsEnabled = true): ProjectDetailTabsViewModel {
  return {
    appRole,
    qaChecklistsEnabled,
    previewDeploymentsEnabled: false,
    highlightMyQaItems: false,
    visibleTabs: ["overview", "checklists"],
    setTab,
    overview: {
      hierarchyRepositoryId: "repo-1",
      health: { checks: [{ key: "ci", label: "CI token", status: "ok", message: "Environment metadata" }] },
      workflow: { path: ".github/workflows/ci.yml" },
      ciAuth: { status: "active" },
      deploymentTargets: { count: 0 },
      syncSnapshot: { enabled: true, latest: null },
      capabilities: { driftDetection: true },
    },
    workflowFiles: [],
    openTargetLogs: jest.fn(),
  } as unknown as ProjectDetailTabsViewModel;
}

let root: Root | null = null;

afterEach(() => {
  summaryProps.length = 0;
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

/* The Overview is the same lean page for every role: no facts grid, access
 * row, snapshot, health checks or drift. */
describe("Overview contents", () => {
  it.each(["lead", "member", "qa", "admin"] as const)("shows %s no facts, access, snapshot, health or drift", async (role) => {
    const container = await render(role);
    const text = container.textContent ?? "";
    for (const gone of ["Workflow", "Checks", "CI token", "Targets", "Manage access", "Local snapshot", "Environment metadata", "Run drift check"]) {
      expect(text).not.toContain(gone);
    }
    expect(container.querySelector("dl.project-detail-grid")).toBeNull();
  });

  it("keeps the failure reason of a failed project", async () => {
    runs.promotion.mockResolvedValue(readyWire() as never);
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <OverviewTab
          project={{ ...PROJECT, status: "failed", failureReason: "Render rejected the service." } as ProvisionedProject}
          vm={vmFor("member")}
        />,
      );
    });
    expect(container.textContent).toContain("Render rejected the service.");
  });

  it("hands the My QA items summary the deep-link highlight and a way to the Checklists tab", async () => {
    await render("member");
    expect(summaryProps).toHaveLength(1);
    const props = summaryProps[0];
    expect(props.enabled).toBe(true);
    expect(props.projectId).toBe("p1");
    (props.onOpenChecklists as () => void)();
    expect(setTab).toHaveBeenCalledWith("checklists");
  });

  it("turns the summary off without the QA capability", async () => {
    await render("member", false);
    expect(summaryProps[0]?.enabled).toBe(false);
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
