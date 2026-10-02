import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ProjectEnvPanel } from "../../src/features/projects/detail/views/project-env-panel";
import { ProjectDetailTabs } from "../../src/features/projects/detail/views/project-detail-tabs";
import { WorkflowCurrentTab } from "../../src/features/workflows/studio/views/workflow-current-tab";
import { useCapabilities } from "../../src/features/capabilities/current";
import { useProjectEnvProvisioning } from "../../src/features/projects/detail/view-models/use-project-env-provisioning-view-model";
import type { ProvisionedProject } from "../../src/shared/api/contracts";
import { getMyUsage } from "../../src/features/projects/detail/data/usage-api";

jest.mock("framer-motion", () => {
  const React = jest.requireActual("react");
  const passthrough = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  const motion = new Proxy(
    {},
    {
      get:
        () =>
        ({
          children,
          ...props
        }: { children?: React.ReactNode } & Record<string, unknown>) => {
          const domProps = { ...props };
          for (const key of [
            "initial",
            "animate",
            "exit",
            "transition",
            "whileHover",
            "whileTap",
            "variants",
            "layout",
            "layoutId",
          ]) {
            delete domProps[key];
          }
          return React.createElement("div", domProps, children);
        },
    },
  );

  return {
    AnimatePresence: passthrough,
    motion,
    useReducedMotion: () => false,
  };
});

jest.mock("../../src/features/capabilities/current", () => ({
  useCapabilities: jest.fn(),
}));

jest.mock("../../src/features/projects/detail/view-models/use-project-env-provisioning-view-model", () => ({
  useProjectEnvProvisioning: jest.fn(),
}));

jest.mock("../../src/features/projects/detail/data/projects-api", () => ({
  getProjectOverview: jest.fn(),
  getWorkflowSettings: jest.fn(),
  previewWorkflowSettings: jest.fn(),
  createWorkflowUpdatePullRequest: jest.fn(),
  syncProjectSnapshot: jest.fn(),
  getProjectCiRuns: jest.fn(),
  getProjectDeployments: jest.fn(),
  getProjectDrift: jest.fn(),
  getProjectAuditEvents: jest.fn(),
  runProjectDriftDetection: jest.fn(),
  repairProjectDriftFinding: jest.fn(),
  getProjectCiRun: jest.fn(),
  rerunProjectCiRun: jest.fn(),
  updateDeploymentTarget: jest.fn(),
  syncDeploymentTarget: jest.fn(),
  detachDeploymentTarget: jest.fn(),
  getDeploymentTargetActions: jest.fn(),
  // Resolved by default: these panels fetch on mount, and a bare jest.fn()
  // returns undefined, which the view-models then call .then() on.
  getProjectPreviews: jest.fn(() =>
    Promise.resolve({
      enabled: false,
      liveProvidersEnabled: false,
      branches: [],
      providerError: null,
    }),
  ),
  getProjectDomains: jest.fn(() => Promise.resolve([])),
  addProjectDomain: jest.fn(() => Promise.resolve(null)),
  verifyProjectDomain: jest.fn(() => Promise.resolve(null)),
  removeProjectDomain: jest.fn(() =>
    Promise.resolve({ removed: true, hostname: "", providerError: null }),
  ),
}));

// WorkflowCurrentTab's view-model reads ?group= / ?project= once on arrival.
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/workflows",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

// Current Projects shows the header's team, resolved against the caller's
// teams — resolve to "no teams" by default.
jest.mock("../../src/features/groups/data/hierarchy-api", () => ({
  getGroups: jest.fn().mockResolvedValue([]),
}));

jest.mock("../../src/features/projects/detail/data/usage-api", () => ({
  getMyUsage: jest.fn(),
}));

jest.mock("../../src/features/workflows/studio/data/catalog-api", () => {
  const actual = jest.requireActual(
    "../../src/features/workflows/studio/data/catalog-api",
  ) as Record<string, unknown>;
  return {
    ...actual,
    getCentralWorkflowTags: jest.fn(() =>
      Promise.resolve({ tags: ["v1", "v2"] }),
    ),
  };
});

const mockedUseCapabilities = useCapabilities as jest.MockedFunction<
  typeof useCapabilities
>;
const mockedUseProjectEnvProvisioning =
  useProjectEnvProvisioning as jest.MockedFunction<
    typeof useProjectEnvProvisioning
  >;
const mockedGetMyUsage = getMyUsage as jest.MockedFunction<typeof getMyUsage>;
const mockedProjectApi = jest.requireMock("../../src/features/projects/detail/data/projects-api") as {
  getProjectOverview: jest.Mock;
  getWorkflowSettings: jest.Mock;
  previewWorkflowSettings: jest.Mock;
  createWorkflowUpdatePullRequest: jest.Mock;
  syncProjectSnapshot: jest.Mock;
  getProjectCiRuns: jest.Mock;
  getProjectDeployments: jest.Mock;
  getProjectDrift: jest.Mock;
  getProjectAuditEvents: jest.Mock;
  runProjectDriftDetection: jest.Mock;
  repairProjectDriftFinding: jest.Mock;
  getProjectCiRun: jest.Mock;
  rerunProjectCiRun: jest.Mock;
  updateDeploymentTarget: jest.Mock;
  syncDeploymentTarget: jest.Mock;
  detachDeploymentTarget: jest.Mock;
  getDeploymentTargetActions: jest.Mock;
  getProjectPreviews: jest.Mock;
  getProjectDomains: jest.Mock;
  addProjectDomain: jest.Mock;
  verifyProjectDomain: jest.Mock;
  removeProjectDomain: jest.Mock;
};

const provisionedProject: ProvisionedProject = {
  id: "project-1",
  repoFullName: "tone/orders-api",
  templateId: "nestjs-api",
  serviceName: "orders-api",
  workflowPath: ".github/workflows/00-alphaci-access.yml",
  status: "provisioned",
  githubCommitSha: "abc123",
  githubCommitUrl: null,
  failureReason: null,
  /*
   * `isOwner` is viewer-relative and WorkflowCurrentTab requires it to place a
   * project in the "individual repositories" bucket — a manager who can merely
   * see a project must not have it listed as their own. Without it here the
   * component fell through to its empty state and eighteen assertions in this
   * file were checking an empty screen.
   */
  isOwner: true,
};

const renderTarget = {
  id: "target-render",
  projectId: "project-1",
  slot: "backend" as const,
  ownershipMode: "flowci_managed" as const,
  provider: "render" as const,
  providerConnectionId: null,
  providerProjectId: "srv-1",
  providerProjectName: "orders-api-test",
  repoFullName: "tone/orders-api",
  branchName: "test",
  rootDirectory: "apps/api",
  buildCommand: "npm run build",
  startCommand: "npm run start:prod",
  renderEnvironmentName: "test" as const,
  environmentMap: {},
  providerMetadata: {},
  status: "active" as const,
};

const vercelTarget = {
  id: "target-vercel",
  projectId: "project-1",
  slot: "frontend" as const,
  ownershipMode: "flowci_managed" as const,
  provider: "vercel" as const,
  providerConnectionId: null,
  providerProjectId: "prj_1",
  providerProjectName: "orders-web",
  repoFullName: "tone/orders-api",
  branchName: "main",
  rootDirectory: "apps/web",
  buildCommand: "npm run build",
  startCommand: null,
  environmentMap: {},
  providerMetadata: { vercelTeamSlug: "flowci-team" },
  status: "active" as const,
};

function render(ui: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(ui);
  });

  return { container, root };
}

function changeValue(
  element: {
    nodeName?: string;
    dispatchEvent: (event: Event) => boolean;
  } | null,
  value: string,
) {
  if (!element?.nodeName) {
    throw new Error("changeValue: form control was not found");
  }

  act(() => {
    /*
     * Prefer the element's own prototype setter. `instanceof` and a foreign
     * realm's HTMLInputElement.prototype both fail in jsdom when the node was
     * created in a different document; tagName on a missing query is null.
     */
    const proto = Object.getPrototypeOf(element) as object | null;
    const nodeName = element.nodeName.toUpperCase();
    const fallbackPrototype =
      nodeName === "SELECT"
        ? HTMLSelectElement.prototype
        : nodeName === "TEXTAREA"
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
    const descriptor =
      (proto && Object.getOwnPropertyDescriptor(proto, "value")) ||
      Object.getOwnPropertyDescriptor(fallbackPrototype, "value");
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function clickButton(container: ParentNode, label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (item) => item.textContent === label,
  );
  if (!button) {
    throw new Error(`Button "${label}" was not found`);
  }
  button.click();
}

function mockCapabilities(
  enabled: boolean,
  syncSnapshotsEnabled = false,
  workflowSettingsEnabled = false,
  workflowUpdatePrEnabled = false,
  projectTargetManagementEnabled = false,
  ciRunTrackingEnabled = false,
  deploymentHistoryEnabled = false,
  driftDetectionEnabled = false,
  driftRepairEnabled = false,
  deploymentOwnershipMode: "byo" | "flowci_managed" = "byo",
) {
  mockedUseCapabilities.mockReturnValue({
    capabilities: {
      envProvisioning: {
        enabled,
        providers: enabled ? ["render", "vercel"] : [],
        environments: enabled ? ["test", "uat", "production"] : [],
        modes: enabled ? [deploymentOwnershipMode] : [],
      },
      projectSyncSnapshots: {
        enabled: syncSnapshotsEnabled,
        mode: "local_snapshot",
      },
      workflowSettingsPreview: {
        enabled: workflowSettingsEnabled,
      },
      workflowUpdatePr: {
        enabled: workflowUpdatePrEnabled,
      },
      projectTargetManagement: {
        enabled: projectTargetManagementEnabled,
      },
      ciRunTracking: {
        enabled: ciRunTrackingEnabled,
        liveGithubEnabled: false,
        mode: "local_mock",
      },
      deploymentHistory: {
        enabled: deploymentHistoryEnabled,
        liveProvidersEnabled: false,
        mode: "local_mock",
      },
      driftDetection: {
        enabled: driftDetectionEnabled,
        mode: "local_snapshot",
      },
      driftRepair: {
        enabled: driftRepairEnabled,
        mode: "local_safe",
      },
    },
    envProvisioningEnabled: enabled,
    projectSyncSnapshotsEnabled: syncSnapshotsEnabled,
    workflowSettingsPreviewEnabled: workflowSettingsEnabled,
    workflowUpdatePrEnabled,
    projectTargetManagementEnabled,
    ciRunTrackingEnabled,
    deploymentHistoryEnabled,
    driftDetectionEnabled,
    driftRepairEnabled,
    deploymentOwnershipMode,
    loadCapabilities: jest.fn(),
    loading: false,
  });
}

function mockEnvHook(
  overrides: Partial<ReturnType<typeof useProjectEnvProvisioning>> = {},
) {
  mockedUseProjectEnvProvisioning.mockReturnValue({
    addTarget: jest.fn(),
    load: jest.fn(),
    loading: false,
    metadata: [],
    providerConnections: [],
    provision: jest.fn(),
    removeMetadata: jest.fn(),
    saving: false,
    targets: [],
    usageItems: [],
    validateEnvText: jest.fn(),
    ...overrides,
  });
}

function projectOverviewWithTargets(targets = [renderTarget, vercelTarget]) {
  return {
    project: {
      ...provisionedProject,
      createdAt: "2026-06-12T00:00:00.000Z",
      updatedAt: "2026-06-12T00:00:00.000Z",
    },
    workflow: {
      path: provisionedProject.workflowPath,
      files: [],
      stageCount: 0,
      history: [],
    },
    deploymentTargets: { items: targets, count: targets.length },
    environment: { items: [], count: 0, failedCount: 0 },
    ciAuth: {
      status: "active" as const,
      tokenPresent: true,
      tokenPrefix: "aci_test",
      createdAt: "2026-06-12T00:00:00.000Z",
      updatedAt: "2026-06-12T00:00:00.000Z",
      revokedAt: null,
    },
    health: { summary: "ok" as const, checks: [] },
    syncSnapshot: {
      enabled: true,
      mode: "local_snapshot" as const,
      latest: null,
    },
    capabilities: {
      envProvisioning: true,
      workflowSettings: true,
      syncSnapshots: true,
      ciRunTracking: false,
      deploymentHistory: false,
      driftDetection: false,
    },
  };
}

describe("Project env provisioning UI", () => {
  let root: Root | null = null;

  beforeEach(() => {
    // Baseline capabilities for every test; individual tests re-invoke
    // mockCapabilities to override flags or the deployment ownership mode.
    mockCapabilities(true);
    mockedProjectApi.getProjectOverview.mockReturnValue(
      new Promise(() => undefined),
    );
    mockedProjectApi.getWorkflowSettings.mockResolvedValue({
      enabled: true,
      source: "project_options",
      settings: {
        projectId: "project-1",
        templateId: "be-nestjs",
        projectTypeId: "nestjs-api",
        workflowRecipeId: "backend-api-ci",
        serviceName: "orders-api",
        servicePath: ".",
        nodeVersion: "24",
        packageManager: "npm",
        coverageThreshold: 80,
        centralWorkflowRef: "v1",
        checks: { lint: true, unit: true, build: true, security: true },
      },
    });
    mockedProjectApi.previewWorkflowSettings.mockResolvedValue({
      settings: {
        projectId: "project-1",
        templateId: "be-nestjs",
        projectTypeId: "nestjs-api",
        workflowRecipeId: "backend-api-ci",
        serviceName: "orders-api",
        servicePath: ".",
        nodeVersion: "22",
        packageManager: "npm",
        coverageThreshold: 90,
        centralWorkflowRef: "v1",
        checks: { lint: true, unit: true, build: true, security: true },
      },
      workflowFiles: [
        {
          stage: "access",
          name: "ALPHACI Access Gate",
          path: ".github/workflows/00-alphaci-access.yml",
          gated: true,
          yaml: "name: ALPHACI Access Gate",
        },
        {
          stage: "quality",
          name: "ALPHACI Quality",
          path: ".github/workflows/10-alphaci-quality.yml",
          gated: true,
          yaml: "name: ALPHACI Quality",
        },
        {
          stage: "package",
          name: "ALPHACI Package",
          path: ".github/workflows/20-alphaci-package.yml",
          gated: true,
          yaml: "name: ALPHACI Package",
        },
      ],
      diffSummary: [
        { path: ".github/workflows/00-alphaci-access.yml", status: "changed" },
        { path: ".github/workflows/10-alphaci-quality.yml", status: "new" },
        { path: ".github/workflows/20-alphaci-package.yml", status: "new" },
      ],
      validationWarnings: [],
    });
    mockedProjectApi.createWorkflowUpdatePullRequest.mockResolvedValue({
      projectId: "project-1",
      repoFullName: "tone/orders-api",
      branchName: "alphaci/workflow-update-20260612000000",
      workflowPath: ".github/workflows/00-alphaci-access.yml",
      workflowFiles: [],
      pullRequestNumber: 42,
      pullRequestUrl: "https://github.com/tone/orders-api/pull/42",
      status: "created",
    });
    mockedProjectApi.getProjectCiRuns.mockResolvedValue({
      enabled: true,
      mode: "local_mock",
      liveGithubEnabled: false,
      githubActionsUrl: "https://github.com/tone/orders-api/actions",
      runs: [],
    });
    mockedProjectApi.getProjectDeployments.mockResolvedValue({
      enabled: true,
      mode: "local_mock",
      liveProvidersEnabled: false,
      deployments: [],
    });
    mockedProjectApi.getProjectDrift.mockResolvedValue({
      enabled: true,
      mode: "local_snapshot",
      findings: [],
    });
    mockedProjectApi.getProjectAuditEvents.mockResolvedValue({
      enabled: true,
      items: [],
    });
    mockedProjectApi.runProjectDriftDetection.mockResolvedValue({
      enabled: true,
      mode: "local_snapshot",
      findings: [],
    });
    mockedProjectApi.repairProjectDriftFinding.mockResolvedValue({
      enabled: true,
      mode: "local_safe",
      findingId: "finding-1",
      action: "rotate_ci_token",
      status: "completed",
      message: "CI token rotated in ALPHACI",
      result: { tokenPrefix: "aci_prefix" },
    });
    mockedProjectApi.getProjectCiRun.mockResolvedValue({
      id: "local-project-1-quality",
      stage: "quality",
      workflowName: "ALPHACI Quality",
    });
    mockedProjectApi.rerunProjectCiRun.mockResolvedValue({
      enabled: false,
      runId: "local-project-1-quality",
      reason: "Live GitHub run sync is not enabled",
    });
    mockedProjectApi.updateDeploymentTarget.mockImplementation(
      async (
        _projectId: string,
        _targetId: string,
        payload: Record<string, unknown>,
      ) => ({
        ...renderTarget,
        ...payload,
      }),
    );
    mockedProjectApi.syncDeploymentTarget.mockResolvedValue({
      mode: "local_metadata",
      status: "active",
      findings: [],
      target: renderTarget,
    });
    mockedProjectApi.detachDeploymentTarget.mockResolvedValue({
      detached: true,
      providerResourceDeleted: false,
    });
    mockedProjectApi.getDeploymentTargetActions.mockResolvedValue({
      targetId: "target-render",
      provider: "render",
      actions: {
        sync: { enabled: true, mode: "local_metadata" },
        detach: { enabled: true },
        reinstallDeploymentSecrets: {
          enabled: false,
          reason: "Provider activation required",
        },
        openProviderDashboard: {
          enabled: true,
          url: "https://dashboard.render.com/web/srv-1",
        },
        openProviderConsole: {
          enabled: true,
          url: "https://dashboard.render.com/web/srv-1/logs",
        },
      },
    });
    mockedGetMyUsage.mockResolvedValue({
      enabled: true,
      plan: "free",
      items: [
        { code: "projects", current: 1, limit: 5, upgradeRequired: false },
        { code: "env_keys", current: 4, limit: 25, upgradeRequired: false },
      ],
    });
    mockedProjectApi.syncProjectSnapshot.mockResolvedValue({
      snapshot: {
        id: "snapshot-1",
        status: "warning",
      },
      overview: {
        project: {
          ...provisionedProject,
          createdAt: "2026-06-12T00:00:00.000Z",
          updatedAt: "2026-06-12T00:00:00.000Z",
        },
        workflow: {
          path: provisionedProject.workflowPath,
          files: [],
          stageCount: 0,
          history: [],
        },
        deploymentTargets: { items: [], count: 0 },
        environment: { items: [], count: 0, failedCount: 0 },
        ciAuth: {
          status: "missing",
          tokenPresent: false,
          tokenPrefix: null,
          createdAt: null,
          updatedAt: null,
          revokedAt: null,
        },
        health: { summary: "warning", checks: [] },
        syncSnapshot: {
          enabled: true,
          mode: "local_snapshot",
          latest: {
            id: "snapshot-1",
            projectId: "project-1",
            status: "warning",
            summary: { mode: "local_snapshot" },
            findings: [{ code: "ci_token_missing" }],
            startedAt: "2026-06-12T00:00:00.000Z",
            completedAt: "2026-06-12T00:00:01.000Z",
            createdBy: "user-1",
            createdAt: "2026-06-12T00:00:01.000Z",
          },
        },
        capabilities: {
          envProvisioning: true,
          workflowSettings: false,
          syncSnapshots: true,
          ciRunTracking: false,
          deploymentHistory: false,
          driftDetection: false,
        },
      },
    });
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  /* The dropdown is teams and nothing else. The old rail once carried an
   * "Ungrouped" bucket and a Repositories/Teams toggle for projects owned by
   * no team — both removed with personal workspaces, since every project now
   * belongs to a team and that bucket could never fill. */
  /* The team dropdown was removed with the navigation cleanup: the page shows
   * the header's team, so the heading is plain "Projects" with no picker. */
  it("shows the header team's Projects under a plain heading, with no team picker", async () => {
    mockCapabilities(true);
    mockEnvHook();

    (
      jest.requireMock("../../src/features/groups/data/hierarchy-api") as {
        getGroups: jest.Mock;
      }
    ).getGroups.mockResolvedValueOnce([
      {
        id: "workspace-1",
        name: "Platform",
        description: null,
        status: "active",
      },
    ] as never);

    const rendered = render(
      <WorkflowCurrentTab
        latestResult={null}
        loadingProjects={false}
        onOpenSetup={jest.fn()}
      />,
    );
    root = rendered.root;

    // Flush the teams fetch.
    await act(async () => {});

    // No card and no rail, and no team dropdown in the heading either.
    expect(rendered.container.querySelector(".project-workspace")).toBeNull();
    expect(rendered.container.querySelector(".project-list-rail")).toBeNull();
    expect(rendered.container.querySelector("[role='tablist']")).toBeNull();
    const heading = rendered.container.querySelector("h1");
    expect(heading?.textContent).toMatch(/^Projects/);
    expect(rendered.container.querySelector("[aria-haspopup='listbox']")).toBeNull();
    expect(rendered.container.textContent).not.toContain("Projects owned by this group.");
    expect(rendered.container.textContent).not.toContain("Platform");

    // There is no ownership toggle beside it.
    expect(
      rendered.container.querySelector(".project-ownership-toggle"),
    ).toBeNull();
    expect(rendered.container.textContent).not.toContain(
      "individual repositories",
    );
  });

  it("loads the project overview and renders control-center tabs with empty states", async () => {
    mockCapabilities(true, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue({
      project: {
        ...provisionedProject,
        createdAt: "2026-06-12T00:00:00.000Z",
        updatedAt: "2026-06-12T00:00:00.000Z",
      },
      workflow: {
        path: provisionedProject.workflowPath,
        files: [],
        stageCount: 0,
        history: [],
      },
      deploymentTargets: { items: [], count: 0 },
      environment: { items: [], count: 0, failedCount: 0 },
      ciAuth: {
        status: "missing",
        tokenPresent: false,
        tokenPrefix: null,
        createdAt: null,
        updatedAt: null,
        revokedAt: null,
      },
      health: {
        summary: "warning",
        checks: [
          {
            key: "workflow_bundle",
            label: "Workflow bundle",
            status: "warning",
            message: "No workflow file metadata is tracked yet.",
          },
        ],
      },
      syncSnapshot: {
        enabled: true,
        mode: "local_snapshot",
        latest: null,
      },
      capabilities: {
        envProvisioning: true,
        workflowSettings: false,
        syncSnapshots: true,
        ciRunTracking: false,
        deploymentHistory: false,
        driftDetection: false,
      },
    });

    const rendered = render(
      // admin: this test asserts every section renders, Environment
      // included — Environment is admin/Developer only, so a session with no
      // role would not see it.
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedProjectApi.getProjectOverview).toHaveBeenCalledWith(
      "project-1",
    );
    expect(rendered.container.textContent).toContain("Overview");
    // The Overview no longer carries the snapshot, health checks or facts.
    expect(rendered.container.textContent).not.toContain("Local snapshot");
    expect(rendered.container.textContent).not.toContain("Sync now");
    expect(rendered.container.textContent).not.toContain("CI token");
    expect(rendered.container.textContent).toContain("Workflow");
    expect(rendered.container.textContent).toContain("Hosting");
    expect(rendered.container.textContent).toContain("Environment");
    // "Activity" and "Audit" were once two sections; there is one now, and the
    // rail calls it Audit.
    expect(rendered.container.textContent).toContain("Audit");
    expect(rendered.container.textContent).toContain("Settings");
    // The three sections the workspace added — asserted here so a regression
    // that drops one is caught by the same test that covers the rest.
    expect(rendered.container.textContent).toContain("Code");
    expect(rendered.container.textContent).toContain("Pull requests");
    expect(rendered.container.textContent).toContain("Pipeline runs");
    expect(rendered.container.textContent).not.toContain(
      "No workflow file metadata is tracked yet.",
    );

    const deploymentsTab = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find(
      (button) => button.textContent === "Hosting",
    ) as HTMLButtonElement;
    act(() => {
      deploymentsTab.click();
    });

    expect(rendered.container.textContent).toContain(
      "No deployment targets configured.",
    );
  });

  it("titles the page with the repository and badges an external repo", async () => {
    mockCapabilities(true, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockRejectedValue(new Error("offline"));

    const rendered = render(<ProjectDetailTabs project={provisionedProject} appRole="admin" />);
    root = rendered.root;
    await act(async () => {
      await Promise.resolve();
    });

    // The page header is gone, so this is the route's only title.
    const titles = rendered.container.querySelectorAll("h1");
    expect(titles).toHaveLength(1);
    expect(titles[0]?.textContent).toBe(provisionedProject.repoFullName);
    expect(rendered.container.textContent).not.toContain("External");

    act(() => {
      rendered.root.render(
        <ProjectDetailTabs project={provisionedProject} appRole="admin" external />,
      );
    });

    expect(
      rendered.container.querySelector(".project-status-badge.external")
        ?.textContent,
    ).toBe("External");
  });

  it("renders CI runs empty state from the local contract", async () => {
    mockCapabilities(true, true, false, false, false, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue({
      project: {
        ...provisionedProject,
        createdAt: "2026-06-12T00:00:00.000Z",
        updatedAt: "2026-06-12T00:00:00.000Z",
      },
      workflow: {
        path: provisionedProject.workflowPath,
        files: [],
        stageCount: 0,
        history: [],
      },
      deploymentTargets: { items: [], count: 0 },
      environment: { items: [], count: 0, failedCount: 0 },
      ciAuth: {
        status: "active",
        tokenPresent: true,
        tokenPrefix: "aci_test",
        createdAt: "2026-06-12T00:00:00.000Z",
        updatedAt: "2026-06-12T00:00:00.000Z",
        revokedAt: null,
      },
      health: { summary: "ok", checks: [] },
      syncSnapshot: { enabled: true, mode: "local_snapshot", latest: null },
      capabilities: {
        envProvisioning: true,
        workflowSettings: false,
        syncSnapshots: true,
        ciRunTracking: true,
        deploymentHistory: false,
        driftDetection: false,
      },
    });

    const rendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const runsTab = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Pipeline runs") as HTMLButtonElement;
    await act(async () => {
      runsTab.click();
      await Promise.resolve();
    });

    expect(mockedProjectApi.getProjectCiRuns).toHaveBeenCalledWith("project-1");
    expect(rendered.container.textContent).toContain(
      "Live GitHub run sync is not enabled",
    );
    expect(rendered.container.textContent).toContain("No CI runs tracked yet.");
  });

  it("renders failed CI run with GitHub link and hides rerun when disabled", async () => {
    mockCapabilities(true, true, false, false, false, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue({
      ...projectOverviewWithTargets([]),
      capabilities: {
        envProvisioning: true,
        workflowSettings: false,
        syncSnapshots: true,
        ciRunTracking: true,
        deploymentHistory: false,
        driftDetection: false,
      },
    });
    mockedProjectApi.getProjectCiRuns.mockResolvedValue({
      enabled: true,
      mode: "local_mock",
      liveGithubEnabled: false,
      githubActionsUrl: "https://github.com/tone/orders-api/actions",
      runs: [
        {
          id: "local-project-1-quality",
          stage: "quality",
          workflowName: "ALPHACI Quality",
          branch: "test",
          commitSha: "abc123",
          actor: "alphaci-local",
          status: "completed",
          conclusion: "failure",
          createdAt: "2026-06-12T00:00:00.000Z",
          updatedAt: "2026-06-12T00:05:00.000Z",
          htmlUrl: "https://github.com/tone/orders-api/actions/runs/1",
          canRerun: false,
        },
      ],
    });

    const rendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const runsTab = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Pipeline runs") as HTMLButtonElement;
    await act(async () => {
      runsTab.click();
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain("ALPHACI Quality");
    expect(rendered.container.textContent).toContain("quality");
    expect(rendered.container.textContent).toContain("test");
    expect(rendered.container.textContent).toContain("abc123");
    expect(rendered.container.textContent).toContain("failure");
    expect(rendered.container.textContent).not.toContain("Rerun");
    expect(
      rendered.container.querySelector(
        'a[href="https://github.com/tone/orders-api/actions/runs/1"]',
      ),
    ).not.toBeNull();
  });

  it("shows a simulated-data caveat for CI runs when live sync is enabled but nothing is connected", async () => {
    mockCapabilities(true, true, false, false, false, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue({
      ...projectOverviewWithTargets([]),
      capabilities: {
        envProvisioning: true,
        workflowSettings: false,
        syncSnapshots: true,
        ciRunTracking: true,
        deploymentHistory: false,
        driftDetection: false,
      },
    });
    mockedProjectApi.getProjectCiRuns.mockResolvedValue({
      enabled: true,
      mode: "local_mock",
      liveGithubEnabled: true,
      githubActionsUrl: "https://github.com/tone/orders-api/actions",
      runs: [],
    });

    const rendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const runsTab = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Pipeline runs") as HTMLButtonElement;
    await act(async () => {
      runsTab.click();
      await Promise.resolve();
    });

    expect(rendered.container.textContent).not.toContain(
      "Live GitHub run sync is not enabled",
    );
    expect(rendered.container.textContent).toContain(
      "Live sync is enabled, but no GitHub Actions integration is connected yet",
    );
  });

  it("renders Vercel and Render deployment target cards", async () => {
    mockCapabilities(true, true, false, false, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue(
      projectOverviewWithTargets(),
    );

    const rendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const deploymentsTab = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find(
      (button) => button.textContent === "Hosting",
    ) as HTMLButtonElement;
    act(() => {
      deploymentsTab.click();
    });

    expect(rendered.container.textContent).toContain("orders-api-test");
    expect(rendered.container.textContent).toContain("render · backend · test");
    expect(rendered.container.textContent).toContain("orders-web");
    expect(rendered.container.textContent).toContain(
      "vercel · frontend · main",
    );
    // Provider activation SHIPPED — this used to assert a "coming soon"
    // placeholder that no longer renders. Each target now carries its own
    // controls, which is what replaced it.
    expect(rendered.container.textContent).toContain("Edit");
    expect(rendered.container.textContent).toContain("Sync");
    expect(rendered.container.textContent).toContain("Detach");
    // The log viewer is opened by a "Logs" control on each target now;
    // "Live console" was the old always-visible heading.
    expect(rendered.container.textContent).toContain("Logs");
  });

  it("renders mixed Render and Vercel deployment history from the local contract", async () => {
    mockCapabilities(true, true, false, false, true, false, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue({
      ...projectOverviewWithTargets(),
      capabilities: {
        envProvisioning: true,
        workflowSettings: false,
        syncSnapshots: true,
        ciRunTracking: false,
        deploymentHistory: true,
        driftDetection: false,
      },
    });
    mockedProjectApi.getProjectDeployments.mockResolvedValue({
      enabled: true,
      mode: "local_mock",
      liveProvidersEnabled: false,
      deployments: [
        {
          id: "deploy-render-1",
          targetId: "target-render",
          targetName: "orders-api-test",
          provider: "render",
          environment: "test",
          branch: "test",
          commitSha: "abc123",
          status: "ready",
          createdAt: "2026-06-12T00:00:00.000Z",
          readyAt: "2026-06-12T00:05:00.000Z",
          commitMessage: null,
          deploymentUrl: "https://orders-api-test.onrender.com",
          pullRequestNumber: null,
          inspectorUrl: null,
          dashboardUrl: "https://dashboard.render.com/web/srv-1",
          consoleUrl: "https://dashboard.render.com/web/srv-1/logs",
        },
        {
          id: "deploy-vercel-1",
          targetId: "target-vercel",
          targetName: "orders-web",
          provider: "vercel",
          environment: "production",
          branch: "main",
          commitSha: "def456",
          status: "building",
          createdAt: "2026-06-12T00:10:00.000Z",
          readyAt: null,
          providerUrl: "https://vercel.com/flowci-team/orders-web",
          consoleUrl: "https://vercel.com/flowci-team/orders-web/deployments",
        },
      ],
    });

    const rendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const deploymentsTab = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find(
      (button) => button.textContent === "Hosting",
    ) as HTMLButtonElement;
    await act(async () => {
      deploymentsTab.click();
      await Promise.resolve();
    });

    expect(mockedProjectApi.getProjectDeployments).toHaveBeenCalledWith(
      "project-1",
    );
    expect(rendered.container.textContent).toContain(
      "Live deployment sync is not enabled",
    );
    expect(rendered.container.textContent).toContain("orders-api-test");
    expect(rendered.container.textContent).toContain("render - test - ready");
    expect(rendered.container.textContent).toContain("abc123");
    expect(rendered.container.textContent).toContain("orders-web");
    expect(rendered.container.textContent).toContain(
      "vercel - production - building",
    );
    expect(rendered.container.textContent).toContain("def456");
    expect(
      rendered.container.querySelector(
        'a[href="https://orders-api-test.onrender.com"]',
      ),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        'a[href="https://dashboard.render.com/web/srv-1/logs"]',
      ),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        'a[href="https://vercel.com/flowci-team/orders-web/deployments"]',
      ),
    ).not.toBeNull();
  });

  it("shows a simulated-data caveat for deployment history when live sync is enabled but nothing is connected", async () => {
    mockCapabilities(true, true, false, false, true, false, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue({
      ...projectOverviewWithTargets(),
      capabilities: {
        envProvisioning: true,
        workflowSettings: false,
        syncSnapshots: true,
        ciRunTracking: false,
        deploymentHistory: true,
        driftDetection: false,
      },
    });
    mockedProjectApi.getProjectDeployments.mockResolvedValue({
      enabled: true,
      mode: "local_mock",
      liveProvidersEnabled: true,
      deployments: [],
    });

    const rendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const deploymentsTab = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find(
      (button) => button.textContent === "Hosting",
    ) as HTMLButtonElement;
    await act(async () => {
      deploymentsTab.click();
      await Promise.resolve();
    });

    expect(rendered.container.textContent).not.toContain(
      "Live deployment sync is not enabled",
    );
    expect(rendered.container.textContent).toContain(
      "Live sync is enabled, but no provider integration is connected yet",
    );
  });

  it("opens target edit drawer with the current metadata values", async () => {
    mockCapabilities(true, true, false, false, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue(
      projectOverviewWithTargets(),
    );

    const rendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const deploymentsTab = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find(
      (button) => button.textContent === "Hosting",
    ) as HTMLButtonElement;
    act(() => {
      deploymentsTab.click();
    });

    const editButton = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Edit") as HTMLButtonElement;
    act(() => {
      editButton.click();
    });

    expect(
      rendered.container.querySelector('[data-testid="target-edit-drawer"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector<HTMLInputElement>(
        'input[aria-label="Target display name"]',
      )?.value,
    ).toBe("orders-api-test");
    expect(rendered.container.textContent).toContain("Render backend");
    expect(
      rendered.container.querySelector<HTMLInputElement>(
        'input[aria-label="Target branch"]',
      )?.value,
    ).toBe("test");
    expect(
      rendered.container.querySelector<HTMLInputElement>(
        'input[aria-label="Target root directory"]',
      )?.value,
    ).toBe("apps/api");
    expect(
      rendered.container.querySelector<HTMLInputElement>(
        'input[aria-label="Target build command"]',
      )?.value,
    ).toBe("npm run build");
    expect(
      rendered.container.querySelector<HTMLInputElement>(
        'input[aria-label="Target start command"]',
      )?.value,
    ).toBe("npm run start:prod");
    expect(
      rendered.container.querySelector<HTMLSelectElement>(
        'select[aria-label="Target provider environment"]',
      )?.value,
    ).toBe("test");
  });

  it("saves edited deployment target metadata and syncs local findings", async () => {
    mockCapabilities(true, true, false, false, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue(
      projectOverviewWithTargets([renderTarget]),
    );
    mockedProjectApi.updateDeploymentTarget.mockResolvedValue({
      ...renderTarget,
      providerProjectName: "orders-api-uat",
      branchName: "uat",
      rootDirectory: null,
      buildCommand: null,
      startCommand: null,
      renderEnvironmentName: "uat",
    });
    mockedProjectApi.syncDeploymentTarget.mockResolvedValue({
      mode: "local_metadata",
      status: "warning",
      findings: [
        { code: "render_service_missing", message: "Service not found" },
      ],
      target: {
        ...renderTarget,
        status: "warning",
      },
    });

    const rendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Hosting")!
        .click();
    });
    act(() => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Edit")!
        .click();
    });

    changeValue(
      rendered.container.querySelector<HTMLInputElement>(
        'input[aria-label="Target display name"]',
      )!,
      "orders-api-uat",
    );
    changeValue(
      rendered.container.querySelector<HTMLInputElement>(
        'input[aria-label="Target branch"]',
      )!,
      "uat",
    );
    changeValue(
      rendered.container.querySelector<HTMLInputElement>(
        'input[aria-label="Target root directory"]',
      )!,
      "   ",
    );
    changeValue(
      rendered.container.querySelector<HTMLInputElement>(
        'input[aria-label="Target build command"]',
      )!,
      "   ",
    );
    changeValue(
      rendered.container.querySelector<HTMLInputElement>(
        'input[aria-label="Target start command"]',
      )!,
      "   ",
    );
    changeValue(
      rendered.container.querySelector<HTMLSelectElement>(
        'select[aria-label="Target provider environment"]',
      )!,
      "uat",
    );

    await act(async () => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save metadata")!
        .click();
      await Promise.resolve();
    });

    expect(mockedProjectApi.updateDeploymentTarget).toHaveBeenCalledWith(
      "project-1",
      "target-render",
      expect.objectContaining({
        branchName: "uat",
        buildCommand: null,
        providerProjectName: "orders-api-uat",
        renderEnvironmentName: "uat",
        rootDirectory: null,
        slot: "backend",
        startCommand: null,
      }),
    );
    expect(rendered.container.textContent).toContain("orders-api-uat");

    await act(async () => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Sync")!
        .click();
      await Promise.resolve();
    });

    expect(mockedProjectApi.syncDeploymentTarget).toHaveBeenCalledWith(
      "project-1",
      "target-render",
    );
  });

  it("shows clean messages when deployment target actions fail", async () => {
    mockCapabilities(true, true, false, false, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue(
      projectOverviewWithTargets([renderTarget]),
    );
    mockedProjectApi.updateDeploymentTarget.mockRejectedValueOnce(
      new Error("update failed"),
    );
    mockedProjectApi.syncDeploymentTarget.mockRejectedValueOnce(
      new Error("sync failed"),
    );
    mockedProjectApi.detachDeploymentTarget.mockRejectedValueOnce(
      new Error("detach failed"),
    );

    const rendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Hosting")!
        .click();
    });
    act(() => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Edit")!
        .click();
    });

    await act(async () => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save metadata")!
        .click();
      await Promise.resolve();
    });
    expect(rendered.container.textContent).toContain(
      "Unable to update target metadata.",
    );

    await act(async () => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Sync")!
        .click();
      await Promise.resolve();
    });
    expect(rendered.container.textContent).toContain(
      "Unable to sync target metadata.",
    );

    act(() => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Detach")!
        .click();
    });
    await act(async () => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Confirm detach")!
        .click();
      await Promise.resolve();
    });
    expect(rendered.container.textContent).toContain(
      "Unable to detach deployment target.",
    );
  });

  it("requires confirmation before detaching a target from ALPHACI", async () => {
    mockCapabilities(true, true, false, false, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue(
      projectOverviewWithTargets([renderTarget]),
    );

    const rendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const deploymentsTab = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find(
      (button) => button.textContent === "Hosting",
    ) as HTMLButtonElement;
    act(() => {
      deploymentsTab.click();
    });

    const detachButton = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Detach") as HTMLButtonElement;
    act(() => {
      detachButton.click();
    });

    expect(mockedProjectApi.detachDeploymentTarget).not.toHaveBeenCalled();
    expect(rendered.container.textContent).toContain("Confirm detach");
    expect(rendered.container.textContent).toContain(
      "Also delete the render resource (orders-api-test). This cannot be undone.",
    );

    const confirmButton = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find(
      (button) => button.textContent === "Confirm detach",
    ) as HTMLButtonElement;
    await act(async () => {
      confirmButton.click();
      await Promise.resolve();
    });

    expect(mockedProjectApi.detachDeploymentTarget).toHaveBeenCalledWith(
      "project-1",
      "target-render",
      { deleteProviderResource: false },
    );
    // Note: with the last target removed, DeploymentTargetsList falls back to
    // its "No deployment targets configured." empty state before the success
    // message (targetMessage) has a chance to render — this is pre-existing
    // behavior of the early-return guard, not something introduced here.
    expect(rendered.container.textContent).toContain(
      "No deployment targets configured.",
    );
  });

  it("opts in to deleting the live provider resource when the checkbox is checked", async () => {
    mockCapabilities(true, true, false, false, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue(
      projectOverviewWithTargets([renderTarget]),
    );
    mockedProjectApi.detachDeploymentTarget.mockResolvedValue({
      detached: true,
      providerResourceDeleted: true,
    });

    const rendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const deploymentsTab = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find(
      (button) => button.textContent === "Hosting",
    ) as HTMLButtonElement;
    act(() => {
      deploymentsTab.click();
    });

    const detachButton = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Detach") as HTMLButtonElement;
    act(() => {
      detachButton.click();
    });

    // Checkbox is unchecked by default — the opt-in must be explicit.
    const deleteResourceCheckbox = rendered.container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(deleteResourceCheckbox.checked).toBe(false);
    act(() => {
      deleteResourceCheckbox.click();
    });
    expect(deleteResourceCheckbox.checked).toBe(true);

    const confirmButton = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find(
      (button) => button.textContent === "Confirm detach",
    ) as HTMLButtonElement;
    await act(async () => {
      confirmButton.click();
      await Promise.resolve();
    });

    // The checked box must flow through as an explicit true — never inferred.
    expect(mockedProjectApi.detachDeploymentTarget).toHaveBeenCalledWith(
      "project-1",
      "target-render",
      { deleteProviderResource: true },
    );
  });

  it("loads workflow settings and previews generated files without showing PR actions", async () => {
    mockCapabilities(true, true, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue({
      project: {
        ...provisionedProject,
        createdAt: "2026-06-12T00:00:00.000Z",
        updatedAt: "2026-06-12T00:00:00.000Z",
      },
      workflow: {
        path: provisionedProject.workflowPath,
        files: [],
        stageCount: 0,
        history: [],
      },
      deploymentTargets: { items: [], count: 0 },
      environment: { items: [], count: 0, failedCount: 0 },
      ciAuth: {
        status: "active",
        tokenPresent: true,
        tokenPrefix: "aci_test",
        createdAt: "2026-06-12T00:00:00.000Z",
        updatedAt: "2026-06-12T00:00:00.000Z",
        revokedAt: null,
      },
      health: { summary: "ok", checks: [] },
      syncSnapshot: {
        enabled: true,
        mode: "local_snapshot",
        latest: null,
      },
      capabilities: {
        envProvisioning: true,
        workflowSettings: true,
        syncSnapshots: true,
        ciRunTracking: false,
        deploymentHistory: false,
        driftDetection: false,
      },
    });

    const rendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const workflowTab = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Workflow") as HTMLButtonElement;
    await act(async () => {
      workflowTab.click();
      await Promise.resolve();
    });

    expect(mockedProjectApi.getWorkflowSettings).toHaveBeenCalledWith(
      "project-1",
    );
    expect(rendered.container.textContent).toContain("Workflow settings");
    expect(rendered.container.textContent).toContain("Lint");
    expect(rendered.container.textContent).toContain("Unit tests");
    expect(rendered.container.textContent).toContain("Build");
    expect(rendered.container.textContent).toContain("Security");
    expect(rendered.container.textContent).toContain("Deploy target mappings");
    expect(rendered.container.textContent).toContain("Node version");
    expect(rendered.container.textContent).toContain("Preview");
    expect(rendered.container.textContent).not.toContain("Create update PR");

    const previewButton = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Preview") as HTMLButtonElement;
    await act(async () => {
      previewButton.click();
      await Promise.resolve();
    });

    expect(mockedProjectApi.previewWorkflowSettings).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({
        nodeVersion: "24",
      }),
    );
    expect(rendered.container.textContent).toContain(
      ".github/workflows/00-alphaci-access.yml",
    );
    expect(rendered.container.textContent).toContain("changed");
    expect(rendered.container.textContent).toContain("new");
  });

  it("shows Create update PR after preview only when capability is enabled", async () => {
    mockCapabilities(true, true, true, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue({
      project: {
        ...provisionedProject,
        createdAt: "2026-06-12T00:00:00.000Z",
        updatedAt: "2026-06-12T00:00:00.000Z",
      },
      workflow: {
        path: provisionedProject.workflowPath,
        files: [],
        stageCount: 0,
        history: [],
      },
      deploymentTargets: { items: [], count: 0 },
      environment: { items: [], count: 0, failedCount: 0 },
      ciAuth: {
        status: "active",
        tokenPresent: true,
        tokenPrefix: "aci_test",
        createdAt: "2026-06-12T00:00:00.000Z",
        updatedAt: "2026-06-12T00:00:00.000Z",
        revokedAt: null,
      },
      health: { summary: "ok", checks: [] },
      syncSnapshot: { enabled: true, mode: "local_snapshot", latest: null },
      capabilities: {
        envProvisioning: true,
        workflowSettings: true,
        syncSnapshots: true,
        ciRunTracking: false,
        deploymentHistory: false,
        driftDetection: false,
      },
    });

    const rendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const workflowTab = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Workflow") as HTMLButtonElement;
    await act(async () => {
      workflowTab.click();
      await Promise.resolve();
    });

    const previewButton = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Preview") as HTMLButtonElement;
    await act(async () => {
      previewButton.click();
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain("Create update PR");

    const createPrButton = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find(
      (button) => button.textContent === "Create update PR",
    ) as HTMLButtonElement;
    await act(async () => {
      createPrButton.click();
      await Promise.resolve();
    });

    expect(
      mockedProjectApi.createWorkflowUpdatePullRequest,
    ).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({ nodeVersion: "22" }),
    );
    expect(rendered.container.textContent).toContain(
      "https://github.com/tone/orders-api/pull/42",
    );
  });


  // A Product owner (lead) and QA Team have no Workflow tab at all.
  it.each([["member", true], ["admin", true]] as const)(
    "update PR button for %s: shown=%s",
    async (role, shown) => {
    mockCapabilities(true, true, true, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue({
      project: {
        ...provisionedProject,
        createdAt: "2026-06-12T00:00:00.000Z",
        updatedAt: "2026-06-12T00:00:00.000Z",
      },
      workflow: {
        path: provisionedProject.workflowPath,
        files: [],
        stageCount: 0,
        history: [],
      },
      deploymentTargets: { items: [], count: 0 },
      environment: { items: [], count: 0, failedCount: 0 },
      ciAuth: {
        status: "active",
        tokenPresent: true,
        tokenPrefix: "aci_test",
        createdAt: "2026-06-12T00:00:00.000Z",
        updatedAt: "2026-06-12T00:00:00.000Z",
        revokedAt: null,
      },
      health: { summary: "ok", checks: [] },
      syncSnapshot: { enabled: true, mode: "local_snapshot", latest: null },
      capabilities: {
        envProvisioning: true,
        workflowSettings: true,
        syncSnapshots: true,
        ciRunTracking: false,
        deploymentHistory: false,
        driftDetection: false,
      },
    });

    const rendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole={role} />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const workflowTab = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Workflow") as HTMLButtonElement;
    await act(async () => {
      workflowTab.click();
      await Promise.resolve();
    });

    const previewButton = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Preview") as HTMLButtonElement;
    await act(async () => {
      previewButton.click();
      await Promise.resolve();
    });

    const hasButton = Array.from(rendered.container.querySelectorAll("button")).some(
      (button) => button.textContent === "Create update PR",
    );
    expect(hasButton).toBe(shown);
    expect(rendered.container.textContent?.includes("A Developer, Team lead or admin can")).toBe(!shown);
    if (shown) {
      expect(rendered.container.textContent).toContain("Opens a pull request into dev");
    }
  },
  );

  it("shows clean copy when workflow update PR creation fails", async () => {
    mockCapabilities(true, true, true, true);
    mockEnvHook();
    mockedProjectApi.createWorkflowUpdatePullRequest.mockRejectedValueOnce(
      new Error("422"),
    );
    mockedProjectApi.getProjectOverview.mockResolvedValue({
      project: {
        ...provisionedProject,
        createdAt: "2026-06-12T00:00:00.000Z",
        updatedAt: "2026-06-12T00:00:00.000Z",
      },
      workflow: {
        path: provisionedProject.workflowPath,
        files: [],
        stageCount: 0,
        history: [],
      },
      deploymentTargets: { items: [], count: 0 },
      environment: { items: [], count: 0, failedCount: 0 },
      ciAuth: {
        status: "active",
        tokenPresent: true,
        tokenPrefix: "aci_test",
        createdAt: "2026-06-12T00:00:00.000Z",
        updatedAt: "2026-06-12T00:00:00.000Z",
        revokedAt: null,
      },
      health: { summary: "ok", checks: [] },
      syncSnapshot: { enabled: true, mode: "local_snapshot", latest: null },
      capabilities: {
        envProvisioning: true,
        workflowSettings: true,
        syncSnapshots: true,
        ciRunTracking: false,
        deploymentHistory: false,
        driftDetection: false,
      },
    });

    const rendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const workflowTab = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Workflow") as HTMLButtonElement;
    await act(async () => {
      workflowTab.click();
      await Promise.resolve();
    });

    const previewButton = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Preview") as HTMLButtonElement;
    await act(async () => {
      previewButton.click();
      await Promise.resolve();
    });

    const createPrButton = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find(
      (button) => button.textContent === "Create update PR",
    ) as HTMLButtonElement;
    await act(async () => {
      createPrButton.click();
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain(
      "Unable to create workflow update PR.",
    );
  });

  it("renders project detail load errors from async project APIs", async () => {
    mockCapabilities(true, true, true, false, true, true, true, true, false);
    mockEnvHook();
    const overview = projectOverviewWithTargets([
      renderTarget,
      {
        ...vercelTarget,
        id: "target-unknown",
        provider: "railway",
        providerMetadata: {},
      } as typeof vercelTarget,
    ]);
    overview.capabilities = {
      ...overview.capabilities,
      ciRunTracking: true,
      deploymentHistory: true,
      driftDetection: true,
      workflowSettings: true,
    };
    mockedProjectApi.getProjectOverview.mockResolvedValue(overview);
    mockedProjectApi.getProjectCiRuns.mockRejectedValueOnce(
      new Error("runs unavailable"),
    );
    mockedProjectApi.getProjectDeployments.mockRejectedValueOnce(
      new Error("deployments unavailable"),
    );
    mockedProjectApi.getProjectAuditEvents.mockRejectedValueOnce(
      new Error("audit unavailable"),
    );
    mockedProjectApi.getWorkflowSettings.mockRejectedValueOnce(
      new Error("settings unavailable"),
    );

    const rendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    // The Overview no longer reads drift findings.
    expect(mockedProjectApi.getProjectDrift).not.toHaveBeenCalled();

    await act(async () => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Workflow")!
        .click();
      await Promise.resolve();
    });
    expect(rendered.container.textContent).toContain(
      "Unable to load workflow settings.",
    );

    await act(async () => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Pipeline runs")!
        .click();
      await Promise.resolve();
    });
    expect(rendered.container.textContent).toContain("Unable to load CI runs.");

    await act(async () => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Hosting")!
        .click();
      await Promise.resolve();
    });
    expect(rendered.container.textContent).toContain(
      "Unable to load deployment history.",
    );
    expect(rendered.container.querySelector('a[href*="railway"]')).toBeNull();

    await act(async () => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Audit")!
        .click();
      await Promise.resolve();
    });
    expect(rendered.container.textContent).toContain(
      "Unable to load audit events.",
    );
  });

  it("renders project overview and workflow preview failures", async () => {
    mockCapabilities(true, true, true, false);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockRejectedValueOnce(
      new Error("overview unavailable"),
    );

    const overviewErrorRendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = overviewErrorRendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    expect(overviewErrorRendered.container.textContent).toContain(
      "Unable to load project overview.",
    );

    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";

    mockedProjectApi.getProjectOverview.mockResolvedValue(
      projectOverviewWithTargets([]),
    );
    mockedProjectApi.getWorkflowSettings.mockReset();
    mockedProjectApi.getWorkflowSettings.mockResolvedValue({
      enabled: true,
      source: "project_options",
      settings: {
        projectId: "project-1",
        templateId: "be-nestjs",
        projectTypeId: "nestjs-api",
        workflowRecipeId: "backend-api-ci",
        serviceName: "orders-api",
        servicePath: ".",
        nodeVersion: "24",
        packageManager: "npm",
        coverageThreshold: 80,
        centralWorkflowRef: "v1",
        checks: { lint: true, unit: true, build: true, security: true },
      },
    });
    mockedProjectApi.previewWorkflowSettings.mockReset();
    mockedProjectApi.previewWorkflowSettings.mockRejectedValueOnce(
      new Error("preview unavailable"),
    );

    const previewErrorRendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = previewErrorRendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      Array.from(previewErrorRendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Workflow")!
        .click();
      await Promise.resolve();
    });
    await act(async () => {
      Array.from(previewErrorRendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Preview")!
        .click();
      await Promise.resolve();
    });

    expect(previewErrorRendered.container.textContent).toContain(
      "Unable to preview workflow settings.",
    );
  });

  it("previews workflow settings after editing all workflow inputs", async () => {
    mockCapabilities(true, true, true, false);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue(
      projectOverviewWithTargets([]),
    );

    const rendered = render(
      <ProjectDetailTabs project={provisionedProject} appRole="admin" />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const workflowTab = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Workflow") as HTMLButtonElement;
    await act(async () => {
      workflowTab.click();
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    changeValue(
      rendered.container.querySelector<HTMLSelectElement>(
        'select[aria-label="Coverage threshold"]',
      ),
      "90",
    );
    changeValue(
      rendered.container.querySelector<HTMLInputElement>(
        'input[aria-label="Service path"]',
      ),
      "apps/api",
    );
    changeValue(
      rendered.container.querySelector<HTMLSelectElement>(
        'select[aria-label="Central workflow ref"]',
      ),
      "v2",
    );

    const previewButton = Array.from(
      rendered.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Preview") as HTMLButtonElement;
    await act(async () => {
      previewButton.click();
      await Promise.resolve();
    });

    expect(mockedProjectApi.previewWorkflowSettings).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({
        centralWorkflowRef: "v2",
        coverageThreshold: 90,
        nodeVersion: "24",
        servicePath: "apps/api",
      }),
    );
  });

  it("shows empty and loading states for the projects panel", async () => {
    mockCapabilities(false);
    mockEnvHook();
    const onOpenSetup = jest.fn();

    const emptyRendered = render(
      <WorkflowCurrentTab
        latestResult={null}
        loadingProjects={false}
        onOpenSetup={onOpenSetup}
        guest
      />,
    );
    root = emptyRendered.root;

    // Flush the groups fetch — the empty state only shows once the (empty)
    // groups list has resolved.
    await act(async () => {});

    expect(emptyRendered.container.textContent).toContain(
      "No groups or projects yet.",
    );
    act(() => {
      Array.from(emptyRendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Create a project")!
        .click();
    });
    expect(onOpenSetup).toHaveBeenCalledTimes(1);

    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";

    const loadingRendered = render(
      <WorkflowCurrentTab
        latestResult={null}
        loadingProjects
        onOpenSetup={jest.fn()}
      />,
    );
    root = loadingRendered.root;

    expect(
      loadingRendered.container.querySelectorAll(".skeleton-card"),
    ).toHaveLength(3);
  });

  it("registers BYO existing targets from saved provider connections", async () => {
    const addTarget = jest.fn().mockResolvedValue({
      id: "target-1",
      providerProjectName: "orders-api-render",
      provider: "render",
    });
    mockEnvHook({
      addTarget,
      providerConnections: [
        {
          id: "connection-1",
          provider: "render",
          label: "Render main",
          tokenLastFour: "cret",
          status: "active",
          createdAt: "2026-06-08T00:00:00.000Z",
          updatedAt: "2026-06-08T00:00:00.000Z",
          lastUsedAt: null,
        },
      ],
    });

    const rendered = render(<ProjectEnvPanel project={provisionedProject} />);
    root = rendered.root;

    const modeSelect = rendered.container.querySelector<HTMLSelectElement>(
      '[aria-label="Target action"]',
    )!;

    changeValue(modeSelect, "register_existing");
    const providerProjectId =
      rendered.container.querySelector<HTMLInputElement>(
        'input[placeholder="Provider project ID"]',
      )!;
    const providerProjectName =
      rendered.container.querySelector<HTMLInputElement>(
        'input[placeholder="Provider project name"]',
      )!;
    changeValue(providerProjectId, "srv-123");
    changeValue(providerProjectName, "orders-api-render");
    await act(async () => {
      rendered.container
        .querySelector<HTMLButtonElement>('button[data-testid="save-target"]')!
        .click();
    });

    expect(addTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "register_existing",
        ownershipMode: "byo",
        providerConnectionId: "connection-1",
        providerProjectId: "srv-123",
        providerProjectName: "orders-api-render",
      }),
    );
  });

  it("creates managed targets without a provider connection in flowci_managed deployments", async () => {
    mockCapabilities(
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      "flowci_managed",
    );
    const addTarget = jest.fn().mockResolvedValue({
      id: "target-1",
      providerProjectName: "orders-api-test",
      provider: "render",
    });
    mockEnvHook({ addTarget });

    const rendered = render(<ProjectEnvPanel project={provisionedProject} />);
    root = rendered.root;

    expect(rendered.container.textContent).toContain(
      "Managed by the organization",
    );
    expect(rendered.container.textContent).not.toContain(
      "Bring your own provider",
    );
    expect(
      rendered.container.querySelector('[aria-label="Provider connection"]'),
    ).toBeNull();

    await act(async () => {
      rendered.container
        .querySelector<HTMLButtonElement>('button[data-testid="save-target"]')!
        .click();
    });

    expect(addTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        ownershipMode: "flowci_managed",
      }),
    );
    expect(addTarget.mock.calls[0][0]).not.toHaveProperty(
      "providerConnectionId",
    );
  });

  it("shows clean deployment target setup errors", async () => {
    const addTarget = jest.fn().mockRejectedValueOnce({
      details: {
        message:
          'Vercel project could not be created: 400 {"error":{"code":"invalid_root_directory","message":"If defined, the Root Directory must be a relative path not starting with `./` and not including `../` or other special characters."}}',
      },
    });
    mockEnvHook({
      addTarget,
      providerConnections: [
        {
          id: "connection-1",
          provider: "render",
          label: "Render main",
          tokenLastFour: "cret",
          status: "active",
          createdAt: "2026-06-08T00:00:00.000Z",
          updatedAt: "2026-06-08T00:00:00.000Z",
          lastUsedAt: null,
        },
      ],
    });

    const rendered = render(<ProjectEnvPanel project={provisionedProject} />);
    root = rendered.root;

    const projectName = rendered.container.querySelector<HTMLInputElement>(
      'input[placeholder="Provider project name"]',
    )!;
    changeValue(projectName, "orders-api-render");

    await act(async () => {
      rendered.container
        .querySelector<HTMLButtonElement>('button[data-testid="save-target"]')!
        .click();
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain(
      'Deployment target setup failed: The root directory must be a relative path, for example "frontend". Do not use "./" or "../".',
    );
    expect(rendered.container.textContent).not.toContain(
      "invalid_root_directory",
    );
  });

  it("shows env key quota and disables provisioning when the limit is reached", async () => {
    mockEnvHook({
      targets: [renderTarget],
      usageItems: [
        { code: "projects", current: 1, limit: 5, upgradeRequired: false },
        {
          code: "managed_render_services",
          current: 1,
          limit: 1,
          upgradeRequired: true,
        },
        {
          code: "managed_vercel_projects",
          current: 0,
          limit: 1,
          upgradeRequired: false,
        },
        {
          code: "deployment_targets",
          current: 2,
          limit: 5,
          upgradeRequired: false,
        },
        { code: "env_keys", current: 25, limit: 25, upgradeRequired: true },
      ],
    });

    const rendered = render(<ProjectEnvPanel project={provisionedProject} />);
    root = rendered.root;

    expect(rendered.container.textContent).toContain("Env keys");
    expect(rendered.container.textContent).toContain("25 / 25");
    expect(rendered.container.textContent).toContain(
      "Archived managed Render services",
    );
    expect(rendered.container.textContent).toContain("1 / 1");
    expect(rendered.container.textContent).toContain(
      "Archived managed Vercel projects",
    );
    expect(rendered.container.textContent).toContain("Deployment targets");
    expect(rendered.container.textContent).toContain("2 / 5");

    act(() => {
      clickButton(rendered.container, "Add variable");
    });
    expect(
      Array.from(rendered.container.querySelectorAll("button")).find(
        (button) => button.textContent === "Provision",
      )?.disabled,
    ).toBe(true);
  });

  it("groups env provisioning into target, variables, and provisioned sections", () => {
    mockEnvHook({
      metadata: [
        {
          id: "meta-1",
          projectId: "project-1",
          deploymentTargetId: "target-1",
          lane: "preview" as const,
          gitBranch: "test",
          key: "DATABASE_URL",
          provider: "render",
          valueStored: false,
          lastProvisionedAt: "2026-06-08T00:00:00.000Z",
          lastProvisionedBy: "user-1",
          status: "provisioned",
          errorSummary: null,
        },
      ],
    });

    const rendered = render(<ProjectEnvPanel project={provisionedProject} />);
    root = rendered.root;

    // Heading is provider-specific now, not the generic "Hosting service".
    expect(rendered.container.textContent).toContain("Render backend service");
    // Variables are no longer split by branch — one "Provisioned variables"
    // list with target/environment/status filters replaced that section.
    expect(rendered.container.textContent).toContain("All environments");
    expect(rendered.container.textContent).toContain("Provisioned variables");
  });

  it("updates target creation fields and env row controls", () => {
    mockEnvHook({ targets: [renderTarget] });

    const rendered = render(<ProjectEnvPanel project={provisionedProject} />);
    root = rendered.root;

    act(() => {
      clickButton(rendered.container, "Add variable");
    });
    changeValue(
      rendered.container.querySelector<HTMLInputElement>(
        'input[placeholder="feature/checkout"]',
      ),
      "uat",
    );

    act(() => {
      clickButton(rendered.container, "Add row");
    });
    expect(
      rendered.container.querySelectorAll<HTMLInputElement>(
        'input[placeholder="DATABASE_URL"]',
      ),
    ).toHaveLength(2);

    act(() => {
      rendered.container
        .querySelectorAll<HTMLButtonElement>(
          'button[title="Remove variable"]',
        )[0]!
        .click();
    });
    expect(
      rendered.container.querySelectorAll<HTMLInputElement>(
        'input[placeholder="DATABASE_URL"]',
      ),
    ).toHaveLength(1);
    expect(
      rendered.container.querySelector<HTMLInputElement>(
        'input[placeholder="feature/checkout"]',
      )?.value,
    ).toBe("uat");
    expect(
      rendered.container.querySelector<HTMLInputElement>(
        'input[placeholder="Start command"]',
      ),
    ).toBeNull();
  });

  it("shows clean errors for env validation, provisioning, and deletion failures", async () => {
    const provision = jest.fn().mockRejectedValueOnce({
      details: { message: "provider rejected secret" },
    });
    const validateEnvText = jest.fn().mockRejectedValueOnce({
      details: { message: "invalid .env line" },
    });
    const removeMetadata = jest.fn().mockRejectedValueOnce({
      details: { message: "provider delete failed" },
    });
    mockEnvHook({
      targets: [renderTarget],
      provision,
      validateEnvText,
      removeMetadata,
      metadata: [
        {
          id: "meta-1",
          projectId: "project-1",
          deploymentTargetId: "target-render",
          lane: "preview" as const,
          gitBranch: "test",
          key: "DATABASE_URL",
          provider: "render",
          valueStored: false,
          lastProvisionedAt: "2026-06-08T00:00:00.000Z",
          lastProvisionedBy: "user-1",
          status: "provisioned",
          errorSummary: null,
        },
      ],
    });

    const rendered = render(<ProjectEnvPanel project={provisionedProject} />);
    root = rendered.root;

    act(() => {
      clickButton(rendered.container, "Add variable");
    });
    act(() => {
      clickButton(rendered.container, "Paste a .env file");
    });
    const textarea = rendered.container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Bulk env text"]',
    );
    changeValue(textarea, "BROKEN");
    await act(async () => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Validate .env")!
        .click();
      await Promise.resolve();
    });
    expect(rendered.container.textContent).toContain(
      "Environment variable validation failed: invalid .env line",
    );

    changeValue(
      rendered.container.querySelector<HTMLInputElement>(
        'input[placeholder="DATABASE_URL"]',
      )!,
      "DATABASE_URL",
    );
    changeValue(
      rendered.container.querySelector<HTMLInputElement>(
        'input[placeholder="Value"]',
      )!,
      "secret",
    );
    await act(async () => {
      rendered.container
        .querySelector<HTMLButtonElement>('button[type="submit"]')!
        .click();
      await Promise.resolve();
    });
    expect(rendered.container.textContent).toContain(
      "Environment variable provisioning failed: provider rejected secret",
    );

    act(() => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete")!
        .click();
    });
    await act(async () => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Confirm delete")!
        .click();
      await Promise.resolve();
    });
    expect(rendered.container.textContent).toContain(
      "Environment variable delete failed: provider delete failed",
    );
  });

  it("clears submitted values and shows metadata without secret values", async () => {
    const provision = jest.fn().mockResolvedValue({
      provisioned: [{ key: "DATABASE_URL", status: "provisioned" }],
      failed: [],
    });
    mockEnvHook({
      provision,
      targets: [
        {
          id: "target-1",
          projectId: "project-1",
          slot: "backend",
          ownershipMode: "flowci_managed",
          provider: "render",
          providerConnectionId: null,
          providerProjectId: "srv-1",
          providerProjectName: "orders-api-render",
          repoFullName: "tone/orders-api",
          branchName: "test",
          rootDirectory: ".",
          buildCommand: "npm run build",
          startCommand: "npm run start:prod",
          environmentMap: {},
          status: "active",
        },
      ],
      metadata: [
        {
          id: "meta-1",
          projectId: "project-1",
          deploymentTargetId: "target-1",
          lane: "preview" as const,
          gitBranch: "test",
          key: "DATABASE_URL",
          provider: "render",
          valueStored: false,
          lastProvisionedAt: "2026-06-08T00:00:00.000Z",
          lastProvisionedBy: "user-1",
          status: "provisioned",
          errorSummary: null,
        },
      ],
    });

    const rendered = render(<ProjectEnvPanel project={provisionedProject} />);
    root = rendered.root;
    act(() => {
      clickButton(rendered.container, "Add variable");
    });
    const keyInput = rendered.container.querySelector<HTMLInputElement>(
      'input[placeholder="DATABASE_URL"]',
    );
    const valueInput = rendered.container.querySelector<HTMLInputElement>(
      'input[placeholder="Value"]',
    );

    changeValue(keyInput, "DATABASE_URL");
    changeValue(valueInput, "postgres://secret");
    await act(async () => {
      rendered.container
        .querySelector<HTMLButtonElement>('button[type="submit"]')!
        .click();
    });

    expect(provision).toHaveBeenCalledWith({
      deploymentTargetId: "target-1",
      lane: "preview",
      gitBranch: "test",
      vars: [{ key: "DATABASE_URL", value: "postgres://secret" }],
    });
    expect(
      rendered.container.querySelector('input[placeholder="Value"]'),
    ).toBeNull();
    expect(rendered.container.textContent).toContain("DATABASE_URL");
    expect(rendered.container.textContent).not.toContain("postgres://secret");
  });

  it("validates bulk .env text and clears parsed values before provisioning", async () => {
    const validateEnvText = jest.fn().mockResolvedValue({
      keyCount: 2,
      keys: ["DATABASE_URL", "API_KEY"],
      duplicates: [],
      invalidKeys: [],
      warnings: [],
    });
    mockEnvHook({
      targets: [renderTarget],
      validateEnvText,
    });

    const rendered = render(<ProjectEnvPanel project={provisionedProject} />);
    root = rendered.root;

    act(() => {
      clickButton(rendered.container, "Add variable");
    });
    act(() => {
      clickButton(rendered.container, "Paste a .env file");
    });
    const textarea = rendered.container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Bulk env text"]',
    );
    changeValue(
      textarea,
      'DATABASE_URL=postgres://secret\nAPI_KEY="super-secret"',
    );
    await act(async () => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Validate .env")!
        .click();
      await Promise.resolve();
    });

    expect(validateEnvText).toHaveBeenCalledWith({
      deploymentTargetId: "target-render",
      lane: "preview",
      gitBranch: "test",
      text: 'DATABASE_URL=postgres://secret\nAPI_KEY="super-secret"',
    });
    expect(rendered.container.textContent).toContain("DATABASE_URL");
    expect(rendered.container.textContent).toContain("API_KEY");
    expect(rendered.container.textContent).not.toContain("postgres://secret");
    expect(rendered.container.textContent).not.toContain("super-secret");

    act(() => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Use parsed keys")!
        .click();
    });

    const valueInputs = Array.from(
      rendered.container.querySelectorAll<HTMLInputElement>(
        'input[placeholder="Value"]',
      ),
    );
    expect(valueInputs).toHaveLength(2);
    expect(valueInputs.every((input) => input.value === "")).toBe(true);
  });

  it("filters provisioned metadata by target environment and status", () => {
    mockEnvHook({
      targets: [renderTarget, vercelTarget],
      metadata: [
        {
          id: "meta-1",
          projectId: "project-1",
          deploymentTargetId: "target-render",
          lane: "preview" as const,
          gitBranch: "test",
          key: "DATABASE_URL",
          provider: "render",
          valueStored: false,
          lastProvisionedAt: "2026-06-08T00:00:00.000Z",
          lastProvisionedBy: "user-1",
          status: "provisioned",
          errorSummary: null,
        },
        {
          id: "meta-2",
          projectId: "project-1",
          deploymentTargetId: "target-vercel",
          lane: "production" as const,
          gitBranch: null,
          key: "API_KEY",
          provider: "vercel",
          valueStored: false,
          lastProvisionedAt: "2026-06-08T00:00:00.000Z",
          lastProvisionedBy: "user-1",
          status: "failed",
          errorSummary: "bad value",
        },
      ],
    });

    const rendered = render(<ProjectEnvPanel project={provisionedProject} />);
    root = rendered.root;

    changeValue(
      rendered.container.querySelector<HTMLSelectElement>(
        'select[aria-label="Filter target"]',
      )!,
      "target-vercel",
    );
    changeValue(
      rendered.container.querySelector<HTMLSelectElement>(
        'select[aria-label="Filter environment"]',
      )!,
      "production",
    );
    changeValue(
      rendered.container.querySelector<HTMLSelectElement>(
        'select[aria-label="Filter status"]',
      )!,
      "failed",
    );

    expect(rendered.container.textContent).toContain("API_KEY");
    expect(rendered.container.textContent).not.toContain("DATABASE_URL");
  });

  it("requires confirmation before deleting env metadata", async () => {
    const removeMetadata = jest
      .fn()
      .mockResolvedValue({ removed: true, key: "DATABASE_URL" });
    mockEnvHook({
      targets: [renderTarget],
      removeMetadata,
      metadata: [
        {
          id: "meta-1",
          projectId: "project-1",
          deploymentTargetId: "target-render",
          lane: "preview" as const,
          gitBranch: "test",
          key: "DATABASE_URL",
          provider: "render",
          valueStored: false,
          lastProvisionedAt: "2026-06-08T00:00:00.000Z",
          lastProvisionedBy: "user-1",
          status: "provisioned",
          errorSummary: null,
        },
      ],
    });

    const rendered = render(<ProjectEnvPanel project={provisionedProject} />);
    root = rendered.root;

    act(() => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete")!
        .click();
    });

    expect(removeMetadata).not.toHaveBeenCalled();
    expect(rendered.container.textContent).toContain("Confirm delete");

    await act(async () => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Confirm delete")!
        .click();
      await Promise.resolve();
    });

    expect(removeMetadata).toHaveBeenCalledWith("meta-1");
  });

  it("re-provisions selected keys only after values are re-entered", async () => {
    const provision = jest.fn().mockResolvedValue({
      provisioned: [{ key: "API_KEY", status: "provisioned" }],
      failed: [],
    });
    mockEnvHook({
      targets: [vercelTarget],
      provision,
      metadata: [
        {
          id: "meta-2",
          projectId: "project-1",
          deploymentTargetId: "target-vercel",
          lane: "production" as const,
          gitBranch: null,
          key: "API_KEY",
          provider: "vercel",
          valueStored: false,
          lastProvisionedAt: "2026-06-08T00:00:00.000Z",
          lastProvisionedBy: "user-1",
          status: "failed",
          errorSummary: "bad value",
        },
      ],
    });

    const rendered = render(<ProjectEnvPanel project={provisionedProject} />);
    root = rendered.root;

    act(() => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Re-provision")!
        .click();
    });

    expect(
      rendered.container.querySelector<HTMLInputElement>(
        'input[placeholder="DATABASE_URL"]',
      )?.value,
    ).toBe("API_KEY");
    const valueInput = rendered.container.querySelector<HTMLInputElement>(
      'input[placeholder="Value"]',
    )!;
    expect(valueInput.value).toBe("");
    expect(
      rendered.container.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      )?.disabled,
    ).toBe(true);

    changeValue(valueInput, "new-secret");
    await act(async () => {
      rendered.container
        .querySelector<HTMLButtonElement>('button[type="submit"]')!
        .click();
      await Promise.resolve();
    });

    expect(provision).toHaveBeenCalledWith({
      deploymentTargetId: "target-vercel",
      lane: "production",
      gitBranch: null,
      vars: [{ key: "API_KEY", value: "new-secret" }],
    });
    expect(rendered.container.textContent).not.toContain("new-secret");
  });

  it("shows failed key error summaries without showing values", () => {
    mockEnvHook({
      metadata: [
        {
          id: "meta-1",
          projectId: "project-1",
          deploymentTargetId: "target-1",
          lane: "preview" as const,
          gitBranch: "test",
          key: "API_KEY",
          provider: "vercel",
          valueStored: false,
          lastProvisionedAt: "2026-06-08T00:00:00.000Z",
          lastProvisionedBy: "user-1",
          status: "failed",
          errorSummary:
            'Vercel project could not be created: 400 {"error":{"code":"bad_request","message":"To link a GitHub repository, you need to install the GitHub integration first.","action":"Install GitHub App","repo":"tone/web"}}',
        },
      ],
    });

    const rendered = render(<ProjectEnvPanel project={provisionedProject} />);
    root = rendered.root;

    expect(rendered.container.textContent).toContain("API_KEY");
    expect(rendered.container.textContent).toContain(
      "Vercel cannot access this GitHub repository yet. Install or update the Vercel GitHub integration for the repository owner, then retry.",
    );
    expect(rendered.container.textContent).not.toContain("Install GitHub App");
    expect(rendered.container.textContent).not.toContain("secret");
  });
});
