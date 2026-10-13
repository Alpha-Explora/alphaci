import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectsRepository } from "../../../../../../src/features/projects/data/projects-repository";
import {
  useProjectDetailTabsViewModel,
  type ProjectDetailTabsViewModel,
} from "../../../../../../src/features/projects/detail/view-models/use-project-detail-tabs-view-model";
import type { AppRole } from "../../../../../../src/shared/api/contracts";

jest.mock("../../../../../../src/features/projects/data/projects-repository", () => ({
  projectsRepository: {
    overview: jest.fn(),
    ciRuns: jest.fn(),
    deployments: jest.fn(),
    audit: jest.fn(),
    workflowSettings: jest.fn(),
  },
}));

jest.mock("../../../../../../src/features/capabilities/current", () => ({
  useCapabilities: () => ({
    qaChecklistsEnabled: true,
    envProvisioningEnabled: true,
    previewDeploymentsEnabled: true,
    ciRunTrackingEnabled: false,
    deploymentHistoryEnabled: true,
    projectTargetManagementEnabled: true,
    workflowSettingsPreviewEnabled: false,
    workflowUpdatePrEnabled: false,
  }),
}));

const repo = projectsRepository as jest.Mocked<typeof projectsRepository>;

let root: Root | null = null;
let latest: ProjectDetailTabsViewModel | null = null;

function Harness({
  appRole,
  onRender,
}: Readonly<{ appRole?: AppRole; onRender: (vm: ProjectDetailTabsViewModel) => void }>) {
  onRender(useProjectDetailTabsViewModel({ projectId: "p1", workflowFilesFallback: [], appRole }));
  return null;
}

function vm(): ProjectDetailTabsViewModel {
  if (!latest) throw new Error("not rendered");
  return latest;
}

async function render(hash: string, appRole: AppRole | undefined = "member") {
  window.history.replaceState(null, "", `/projects/p1${hash}`);
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<Harness appRole={appRole} onRender={(value) => (latest = value)} />);
  });
  // Let the overview (and, on Hosting, the deployments) read settle inside act.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function poll(check: () => boolean, attempts = 50): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error("condition not met");
}

beforeEach(() => {
  repo.overview.mockResolvedValue({
    project: { id: "p1" },
    capabilities: { deploymentHistory: true },
    workflow: { files: [] },
    deploymentTargets: { items: [], count: 0 },
    environment: { items: [], count: 0, failedCount: 0 },
  } as never);
  repo.deployments.mockResolvedValue({
    enabled: true,
    mode: "live",
    liveProvidersEnabled: true,
    deployments: [],
    providerError: null,
  });
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  latest = null;
  window.history.replaceState(null, "", "/");
  jest.clearAllMocks();
});

describe("useProjectDetailTabsViewModel: the Environment tab's old links", () => {
  it("opens #environment on Hosting, asking it to focus Variables", async () => {
    await render("#environment");
    expect(vm().tab).toBe("hosting");
    expect(vm().hostingFocus).toBe("variables");
    expect(vm().visibleTabs).not.toContain("environment");
  });

  it("keeps #hosting as it was, with nothing to focus", async () => {
    await render("#hosting");
    expect(vm().tab).toBe("hosting");
    expect(vm().hostingFocus).toBeNull();
  });

  it("drops the focus once the viewer picks a tab by hand", async () => {
    await render("#environment");
    act(() => vm().setTab("overview"));
    act(() => vm().setTab("hosting"));
    expect(vm().hostingFocus).toBeNull();
  });

  it("drops the focus for the Overview's Full logs, which opens Hosting on that target's logs", async () => {
    await render("#environment");
    const focus = { targetId: "t1", window: null };
    act(() => vm().openTargetLogs(focus));
    expect(vm().tab).toBe("hosting");
    expect(vm().logFocus).toEqual(focus);
    expect(vm().hostingFocus).toBeNull();
  });

  it("sends a QA Team member's #environment to Overview", async () => {
    await render("#environment", "qa");
    expect(vm().tab).toBe("overview");
  });
});

describe("useProjectDetailTabsViewModel: reloadDeployments", () => {
  it("reads the deployment history again for Hosting's Retry", async () => {
    await render("#hosting");
    await poll(() => repo.deployments.mock.calls.length === 1 && vm().deployments !== null);
    act(() => vm().reloadDeployments());
    await poll(() => repo.deployments.mock.calls.length === 2);
  });
});
