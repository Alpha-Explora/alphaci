import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ProjectEnvPanel } from "../../src/components/product/project-env-panel";
import { WorkflowCurrentTab } from "../../src/components/product/workflow-current-tab";
import { useCapabilities } from "../../src/hooks/use-capabilities";
import { useProjectEnvProvisioning } from "../../src/hooks/use-project-env-provisioning";
import type { ProvisionedProject } from "../../src/lib/api/contracts";

jest.mock("framer-motion", () => {
  const React = jest.requireActual("react");
  const passthrough = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  const motion = new Proxy(
    {},
    {
      get:
        () =>
        ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => {
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
  };
});

jest.mock("../../src/hooks/use-capabilities", () => ({
  useCapabilities: jest.fn(),
}));

jest.mock("../../src/hooks/use-project-env-provisioning", () => ({
  useProjectEnvProvisioning: jest.fn(),
}));

jest.mock("../../src/lib/api/projects", () => ({
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
}));

const mockedUseCapabilities = useCapabilities as jest.MockedFunction<typeof useCapabilities>;
const mockedUseProjectEnvProvisioning = useProjectEnvProvisioning as jest.MockedFunction<
  typeof useProjectEnvProvisioning
>;
const mockedProjectApi = jest.requireMock("../../src/lib/api/projects") as {
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
};

const provisionedProject: ProvisionedProject = {
  id: "project-1",
  repoFullName: "tone/orders-api",
  templateId: "nestjs-api",
  serviceName: "orders-api",
  workflowPath: ".github/workflows/00-flowci-access.yml",
  status: "provisioned",
  githubCommitSha: "abc123",
  githubCommitUrl: null,
  failureReason: null,
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

function changeValue(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  act(() => {
    const prototype =
      element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(
      prototype,
      "value",
    );
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
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
) {
  mockedUseCapabilities.mockReturnValue({
    capabilities: {
      envProvisioning: {
        enabled,
        providers: enabled ? ["render", "vercel"] : [],
        environments: enabled ? ["test", "uat", "production"] : [],
        modes: enabled ? ["byo", "flowci_managed"] : [],
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
    loadCapabilities: jest.fn(),
    loading: false,
  });
}

function mockEnvHook(overrides: Partial<ReturnType<typeof useProjectEnvProvisioning>> = {}) {
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
      tokenPrefix: "fci_test",
      createdAt: "2026-06-12T00:00:00.000Z",
      updatedAt: "2026-06-12T00:00:00.000Z",
      revokedAt: null,
    },
    health: { summary: "ok" as const, checks: [] },
    syncSnapshot: { enabled: true, mode: "local_snapshot" as const, latest: null },
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
    mockedProjectApi.getProjectOverview.mockReturnValue(new Promise(() => undefined));
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
        nodeVersion: "22",
        coverageThreshold: 90,
      },
      workflowFiles: [
        {
          stage: "access",
          name: "FlowCI Access Gate",
          path: ".github/workflows/00-flowci-access.yml",
          gated: true,
          yaml: "name: FlowCI Access Gate",
        },
        {
          stage: "quality",
          name: "FlowCI Quality",
          path: ".github/workflows/10-flowci-quality.yml",
          gated: true,
          yaml: "name: FlowCI Quality",
        },
        {
          stage: "package",
          name: "FlowCI Package",
          path: ".github/workflows/20-flowci-package.yml",
          gated: true,
          yaml: "name: FlowCI Package",
        },
      ],
      diffSummary: [
        { path: ".github/workflows/00-flowci-access.yml", status: "changed" },
        { path: ".github/workflows/10-flowci-quality.yml", status: "new" },
        { path: ".github/workflows/20-flowci-package.yml", status: "new" },
      ],
      validationWarnings: [],
    });
    mockedProjectApi.createWorkflowUpdatePullRequest.mockResolvedValue({
      projectId: "project-1",
      repoFullName: "tone/orders-api",
      branchName: "flowci/workflow-update-20260612000000",
      workflowPath: ".github/workflows/00-flowci-access.yml",
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
      message: "CI token rotated in FlowCI",
      result: { tokenPrefix: "fci_prefix" },
    });
    mockedProjectApi.getProjectCiRun.mockResolvedValue({
      id: "local-project-1-quality",
      stage: "quality",
      workflowName: "FlowCI Quality",
    });
    mockedProjectApi.rerunProjectCiRun.mockResolvedValue({
      enabled: false,
      runId: "local-project-1-quality",
      reason: "Live GitHub run sync is not enabled",
    });
    mockedProjectApi.updateDeploymentTarget.mockImplementation(
      async (_projectId: string, _targetId: string, payload: Record<string, unknown>) => ({
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
    mockedProjectApi.detachDeploymentTarget.mockResolvedValue({ detached: true });
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
      },
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

  it("shows Environment Variables action only for provisioned projects when enabled", () => {
    mockCapabilities(true);
    mockEnvHook();

    const failedProject = { ...provisionedProject, id: "project-2", status: "failed" as const };
    const rendered = render(
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject, failedProject]}
      />,
    );
    root = rendered.root;

    expect(rendered.container.textContent?.match(/Environment Variables/g) ?? []).toHaveLength(1);
  });

  it("hides Environment Variables action when capability is disabled", () => {
    mockCapabilities(false);
    mockEnvHook();

    const rendered = render(
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject]}
      />,
    );
    root = rendered.root;

    expect(rendered.container.textContent).not.toContain("Environment Variables");
  });

  it("uses a split workspace and updates project details from the selector", () => {
    mockCapabilities(true);
    mockEnvHook();

    const frontendProject: ProvisionedProject = {
      ...provisionedProject,
      id: "project-2",
      repoFullName: "tone/web-client",
      serviceName: "web-client",
      status: "provisioned",
      workflowPath: ".github/workflows/10-flowci-quality.yml",
      githubCommitSha: "def456",
    };

    const rendered = render(
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject, frontendProject]}
      />,
    );
    root = rendered.root;

    expect(rendered.container.querySelector(".project-workspace")).not.toBeNull();
    expect(rendered.container.querySelector(".project-list")).not.toBeNull();
    expect(rendered.container.querySelector(".project-detail-panel")).not.toBeNull();
    expect(rendered.container.querySelector(".project-detail-panel")?.textContent).toContain("orders-api");
    expect(rendered.container.querySelector(".project-detail-panel")?.textContent).not.toContain("web-client");

    const webClientSelector = rendered.container.querySelector<HTMLButtonElement>(
      'button[data-project-id="project-2"]',
    )!;
    act(() => {
      webClientSelector.click();
    });

    expect(rendered.container.querySelector(".project-detail-panel")?.textContent).toContain("web-client");
    expect(rendered.container.querySelector(".project-detail-panel")?.textContent).not.toContain("orders-api");
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
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject]}
      />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedProjectApi.getProjectOverview).toHaveBeenCalledWith("project-1");
    expect(rendered.container.textContent).toContain("Overview");
    expect(rendered.container.textContent).toContain("Local snapshot");
    expect(rendered.container.textContent).toContain("Not synced yet");
    expect(rendered.container.textContent).toContain("Sync now");
    expect(rendered.container.textContent).toContain("Workflow");
    expect(rendered.container.textContent).toContain("Deployments");
    expect(rendered.container.textContent).toContain("Environment");
    expect(rendered.container.textContent).toContain("Activity");
    expect(rendered.container.textContent).toContain("Settings");
    expect(rendered.container.textContent).toContain("No workflow file metadata is tracked yet.");

    const deploymentsTab = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Deployments",
    ) as HTMLButtonElement;
    act(() => {
      deploymentsTab.click();
    });

    expect(rendered.container.textContent).toContain("No deployment targets configured.");
  });

  it("runs local project sync and renders the latest snapshot state", async () => {
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
      health: { summary: "warning", checks: [] },
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
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject]}
      />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const syncButton = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Sync now",
    ) as HTMLButtonElement;

    await act(async () => {
      syncButton.click();
      await Promise.resolve();
    });

    expect(mockedProjectApi.syncProjectSnapshot).toHaveBeenCalledWith("project-1");
    expect(rendered.container.textContent).toContain("warning");
    expect(rendered.container.textContent).toContain("1 finding");
  });

  it("renders drift findings and keeps repair actions disabled", async () => {
    mockCapabilities(true, true, false, false, false, false, false, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue({
      ...projectOverviewWithTargets([]),
      capabilities: {
        envProvisioning: true,
        workflowSettings: false,
        syncSnapshots: true,
        ciRunTracking: false,
        deploymentHistory: false,
        driftDetection: true,
      },
    });
    mockedProjectApi.getProjectDrift.mockResolvedValue({
      enabled: true,
      mode: "local_snapshot",
      findings: [
        {
          id: "finding-1",
          projectId: "project-1",
          targetId: null,
          source: "local_snapshot",
          severity: "warning",
          code: "workflow_files_missing",
          message: "No workflow file metadata is tracked for this project.",
          details: {},
          status: "active",
          detectedAt: "2026-06-13T00:00:00.000Z",
          resolvedAt: null,
        },
      ],
    });
    mockedProjectApi.runProjectDriftDetection.mockResolvedValue({
      enabled: true,
      mode: "local_snapshot",
      findings: [
        {
          id: "finding-2",
          projectId: "project-1",
          targetId: null,
          source: "local_snapshot",
          severity: "error",
          code: "ci_token_missing",
          message: "No active CI token metadata is tracked for this project.",
          details: {},
          status: "active",
          detectedAt: "2026-06-13T00:01:00.000Z",
          resolvedAt: null,
        },
      ],
    });

    const rendered = render(
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject]}
      />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedProjectApi.getProjectDrift).toHaveBeenCalledWith("project-1");
    expect(rendered.container.textContent).toContain("Health findings");
    expect(rendered.container.textContent).toContain("workflow_files_missing");
    expect(rendered.container.textContent).toContain("local_snapshot");
    const repairButton = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Repair actions coming in the next phase",
    ) as HTMLButtonElement;
    expect(repairButton.disabled).toBe(true);

    const runButton = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Run drift check",
    ) as HTMLButtonElement;
    await act(async () => {
      runButton.click();
      await Promise.resolve();
    });

    expect(mockedProjectApi.runProjectDriftDetection).toHaveBeenCalledWith("project-1");
    expect(rendered.container.textContent).toContain("ci_token_missing");
  });

  it("requires confirmation before running a supported drift repair", async () => {
    mockCapabilities(true, true, false, false, false, false, false, true, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue({
      ...projectOverviewWithTargets([]),
      capabilities: {
        envProvisioning: true,
        workflowSettings: false,
        syncSnapshots: true,
        ciRunTracking: false,
        deploymentHistory: false,
        driftDetection: true,
      },
    });
    mockedProjectApi.getProjectDrift.mockResolvedValue({
      enabled: true,
      mode: "local_snapshot",
      findings: [
        {
          id: "finding-1",
          projectId: "project-1",
          targetId: null,
          source: "local_snapshot",
          severity: "error",
          code: "ci_token_missing",
          message: "No active CI token metadata is tracked for this project.",
          details: {},
          status: "active",
          detectedAt: "2026-06-13T00:00:00.000Z",
          resolvedAt: null,
        },
      ],
    });

    const rendered = render(
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject]}
      />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const rotateButton = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Rotate CI token",
    ) as HTMLButtonElement;
    act(() => {
      rotateButton.click();
    });

    expect(mockedProjectApi.repairProjectDriftFinding).not.toHaveBeenCalled();
    expect(rendered.container.textContent).toContain("Confirm repair to run this local-safe action.");

    const confirmButton = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Confirm repair",
    ) as HTMLButtonElement;
    await act(async () => {
      confirmButton.click();
      await Promise.resolve();
    });

    expect(mockedProjectApi.repairProjectDriftFinding).toHaveBeenCalledWith(
      "project-1",
      "finding-1",
      "rotate_ci_token",
    );
    expect(rendered.container.textContent).toContain("Run drift check again to refresh findings.");
  });

  it("exposes workflow update PR repair for central workflow drift", async () => {
    mockCapabilities(true, true, false, true, false, false, false, true, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue({
      ...projectOverviewWithTargets([]),
      capabilities: {
        envProvisioning: true,
        workflowSettings: false,
        syncSnapshots: true,
        ciRunTracking: false,
        deploymentHistory: false,
        driftDetection: true,
      },
    });
    mockedProjectApi.getProjectDrift.mockResolvedValue({
      enabled: true,
      mode: "local_snapshot",
      findings: [
        {
          id: "finding-1",
          projectId: "project-1",
          targetId: null,
          source: "local_snapshot",
          severity: "warning",
          code: "central_workflow_ref_outdated",
          message: "Central workflow ref is outdated.",
          details: {},
          status: "active",
          detectedAt: "2026-06-14T00:00:00.000Z",
          resolvedAt: null,
        },
      ],
    });

    const rendered = render(
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject]}
      />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain("central_workflow_ref_outdated");
    expect(rendered.container.textContent).toContain("Create update PR");
    expect(rendered.container.textContent).not.toContain("Preview workflow");
  });

  it("does not show local repair actions for unsupported live-provider findings", async () => {
    mockCapabilities(true, true, false, false, false, false, false, true, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue({
      ...projectOverviewWithTargets([]),
      capabilities: {
        envProvisioning: true,
        workflowSettings: false,
        syncSnapshots: true,
        ciRunTracking: false,
        deploymentHistory: false,
        driftDetection: true,
      },
    });
    mockedProjectApi.getProjectDrift.mockResolvedValue({
      enabled: true,
      mode: "local_snapshot",
      findings: [
        {
          id: "finding-live",
          projectId: "project-1",
          targetId: "target-1",
          source: "local_snapshot",
          severity: "error",
          code: "provider_env_key_missing_live",
          message: "Provider env key needs live activation.",
          details: {},
          status: "active",
          detectedAt: "2026-06-13T00:00:00.000Z",
          resolvedAt: null,
        },
      ],
    });

    const rendered = render(
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject]}
      />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain("provider_env_key_missing_live");
    expect(rendered.container.textContent).not.toContain("Confirm repair");
    expect(rendered.container.textContent).not.toContain("Rotate CI token");
    expect(mockedProjectApi.repairProjectDriftFinding).not.toHaveBeenCalled();
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
      workflow: { path: provisionedProject.workflowPath, files: [], stageCount: 0, history: [] },
      deploymentTargets: { items: [], count: 0 },
      environment: { items: [], count: 0, failedCount: 0 },
      ciAuth: {
        status: "active",
        tokenPresent: true,
        tokenPrefix: "fci_test",
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
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject]}
      />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const runsTab = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Runs",
    ) as HTMLButtonElement;
    await act(async () => {
      runsTab.click();
      await Promise.resolve();
    });

    expect(mockedProjectApi.getProjectCiRuns).toHaveBeenCalledWith("project-1");
    expect(rendered.container.textContent).toContain("Live GitHub run sync is not enabled");
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
          workflowName: "FlowCI Quality",
          branch: "test",
          commitSha: "abc123",
          actor: "flowci-local",
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
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject]}
      />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const runsTab = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Runs",
    ) as HTMLButtonElement;
    await act(async () => {
      runsTab.click();
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain("FlowCI Quality");
    expect(rendered.container.textContent).toContain("quality");
    expect(rendered.container.textContent).toContain("test");
    expect(rendered.container.textContent).toContain("abc123");
    expect(rendered.container.textContent).toContain("failure");
    expect(rendered.container.textContent).not.toContain("Rerun");
    expect(rendered.container.querySelector('a[href="https://github.com/tone/orders-api/actions/runs/1"]')).not.toBeNull();
  });

  it("renders Vercel and Render deployment target cards", async () => {
    mockCapabilities(true, true, false, false, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue(projectOverviewWithTargets());

    const rendered = render(
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject]}
      />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const deploymentsTab = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Deployments",
    ) as HTMLButtonElement;
    act(() => {
      deploymentsTab.click();
    });

    expect(rendered.container.textContent).toContain("orders-api-test");
    expect(rendered.container.textContent).toContain("render - backend - test");
    expect(rendered.container.textContent).toContain("orders-web");
    expect(rendered.container.textContent).toContain("vercel - frontend - main");
    expect(rendered.container.textContent).toContain("Provider activation required");
    expect(rendered.container.textContent).toContain("Open provider dashboard");
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
          providerUrl: "https://dashboard.render.com/web/srv-1",
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
        },
      ],
    });

    const rendered = render(
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject]}
      />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const deploymentsTab = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Deployments",
    ) as HTMLButtonElement;
    await act(async () => {
      deploymentsTab.click();
      await Promise.resolve();
    });

    expect(mockedProjectApi.getProjectDeployments).toHaveBeenCalledWith("project-1");
    expect(rendered.container.textContent).toContain("Live deployment sync is not enabled");
    expect(rendered.container.textContent).toContain("orders-api-test");
    expect(rendered.container.textContent).toContain("render - test - ready");
    expect(rendered.container.textContent).toContain("abc123");
    expect(rendered.container.textContent).toContain("orders-web");
    expect(rendered.container.textContent).toContain("vercel - production - building");
    expect(rendered.container.textContent).toContain("def456");
    expect(rendered.container.querySelector('a[href="https://dashboard.render.com/web/srv-1"]')).not.toBeNull();
    expect(rendered.container.querySelector('a[href="https://vercel.com/flowci-team/orders-web"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain("Provider activation required");
  });

  it("opens target edit drawer with the current metadata values", async () => {
    mockCapabilities(true, true, false, false, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue(projectOverviewWithTargets());

    const rendered = render(
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject]}
      />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const deploymentsTab = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Deployments",
    ) as HTMLButtonElement;
    act(() => {
      deploymentsTab.click();
    });

    const editButton = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Edit",
    ) as HTMLButtonElement;
    act(() => {
      editButton.click();
    });

    expect(rendered.container.querySelector('[data-testid="target-edit-drawer"]')).not.toBeNull();
    expect(rendered.container.querySelector<HTMLInputElement>('input[aria-label="Target display name"]')?.value).toBe(
      "orders-api-test",
    );
    expect(rendered.container.querySelector<HTMLSelectElement>('select[aria-label="Target slot"]')?.value).toBe(
      "backend",
    );
    expect(rendered.container.querySelector<HTMLInputElement>('input[aria-label="Target branch"]')?.value).toBe("test");
    expect(rendered.container.querySelector<HTMLInputElement>('input[aria-label="Target root directory"]')?.value).toBe(
      "apps/api",
    );
    expect(rendered.container.querySelector<HTMLInputElement>('input[aria-label="Target build command"]')?.value).toBe(
      "npm run build",
    );
    expect(rendered.container.querySelector<HTMLInputElement>('input[aria-label="Target start command"]')?.value).toBe(
      "npm run start:prod",
    );
    expect(
      rendered.container.querySelector<HTMLSelectElement>('select[aria-label="Target provider environment"]')?.value,
    ).toBe("test");
  });

  it("requires confirmation before detaching a target from FlowCI", async () => {
    mockCapabilities(true, true, false, false, true);
    mockEnvHook();
    mockedProjectApi.getProjectOverview.mockResolvedValue(projectOverviewWithTargets([renderTarget]));

    const rendered = render(
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject]}
      />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const deploymentsTab = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Deployments",
    ) as HTMLButtonElement;
    act(() => {
      deploymentsTab.click();
    });

    const detachButton = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Detach from FlowCI",
    ) as HTMLButtonElement;
    act(() => {
      detachButton.click();
    });

    expect(mockedProjectApi.detachDeploymentTarget).not.toHaveBeenCalled();
    expect(rendered.container.textContent).toContain("Confirm detach");

    const confirmButton = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Confirm detach",
    ) as HTMLButtonElement;
    await act(async () => {
      confirmButton.click();
      await Promise.resolve();
    });

    expect(mockedProjectApi.detachDeploymentTarget).toHaveBeenCalledWith("project-1", "target-render");
    expect(rendered.container.textContent).toContain("No deployment targets configured.");
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
        tokenPrefix: "fci_test",
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
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject]}
      />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const workflowTab = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Workflow",
    ) as HTMLButtonElement;
    await act(async () => {
      workflowTab.click();
      await Promise.resolve();
    });

    expect(mockedProjectApi.getWorkflowSettings).toHaveBeenCalledWith("project-1");
    expect(rendered.container.textContent).toContain("Workflow settings");
    expect(rendered.container.textContent).toContain("Node version");
    expect(rendered.container.textContent).toContain("Preview");
    expect(rendered.container.textContent).not.toContain("Create update PR");

    const nodeVersionInput = rendered.container.querySelector<HTMLInputElement>('input[aria-label="Node version"]')!;
    changeValue(nodeVersionInput, "22");

    const previewButton = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Preview",
    ) as HTMLButtonElement;
    await act(async () => {
      previewButton.click();
      await Promise.resolve();
    });

    expect(mockedProjectApi.previewWorkflowSettings).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({
        nodeVersion: "22",
      }),
    );
    expect(rendered.container.textContent).toContain(".github/workflows/00-flowci-access.yml");
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
      workflow: { path: provisionedProject.workflowPath, files: [], stageCount: 0, history: [] },
      deploymentTargets: { items: [], count: 0 },
      environment: { items: [], count: 0, failedCount: 0 },
      ciAuth: {
        status: "active",
        tokenPresent: true,
        tokenPrefix: "fci_test",
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
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject]}
      />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const workflowTab = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Workflow",
    ) as HTMLButtonElement;
    await act(async () => {
      workflowTab.click();
      await Promise.resolve();
    });

    const previewButton = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Preview",
    ) as HTMLButtonElement;
    await act(async () => {
      previewButton.click();
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain("Create update PR");

    const createPrButton = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Create update PR",
    ) as HTMLButtonElement;
    await act(async () => {
      createPrButton.click();
      await Promise.resolve();
    });

    expect(mockedProjectApi.createWorkflowUpdatePullRequest).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({ nodeVersion: "22" }),
    );
    expect(rendered.container.textContent).toContain("https://github.com/tone/orders-api/pull/42");
  });

  it("shows clean copy when workflow update PR creation fails", async () => {
    mockCapabilities(true, true, true, true);
    mockEnvHook();
    mockedProjectApi.createWorkflowUpdatePullRequest.mockRejectedValueOnce(new Error("422"));
    mockedProjectApi.getProjectOverview.mockResolvedValue({
      project: {
        ...provisionedProject,
        createdAt: "2026-06-12T00:00:00.000Z",
        updatedAt: "2026-06-12T00:00:00.000Z",
      },
      workflow: { path: provisionedProject.workflowPath, files: [], stageCount: 0, history: [] },
      deploymentTargets: { items: [], count: 0 },
      environment: { items: [], count: 0, failedCount: 0 },
      ciAuth: {
        status: "active",
        tokenPresent: true,
        tokenPrefix: "fci_test",
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
      <WorkflowCurrentTab
        history={[]}
        latestResult={null}
        loadingHistory={false}
        loadingProjects={false}
        onCopyYaml={jest.fn()}
        onDownloadYaml={jest.fn()}
        onOpenSetup={jest.fn()}
        projects={[provisionedProject]}
      />,
    );
    root = rendered.root;

    await act(async () => {
      await Promise.resolve();
    });

    const workflowTab = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Workflow",
    ) as HTMLButtonElement;
    await act(async () => {
      workflowTab.click();
      await Promise.resolve();
    });

    const previewButton = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Preview",
    ) as HTMLButtonElement;
    await act(async () => {
      previewButton.click();
      await Promise.resolve();
    });

    const createPrButton = Array.from(rendered.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Create update PR",
    ) as HTMLButtonElement;
    await act(async () => {
      createPrButton.click();
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain("Unable to create workflow update PR.");
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

    const modeSelect = rendered.container.querySelector<HTMLSelectElement>('[aria-label="Target action"]')!;
    const ownershipSelect = rendered.container.querySelector<HTMLSelectElement>('[aria-label="Ownership mode"]')!;

    changeValue(modeSelect, "register_existing");
    changeValue(ownershipSelect, "byo");
    const providerProjectId = rendered.container.querySelector<HTMLInputElement>('input[placeholder="Provider project ID"]')!;
    const providerProjectName = rendered.container.querySelector<HTMLInputElement>('input[placeholder="Provider project name"]')!;
    changeValue(providerProjectId, "srv-123");
    changeValue(providerProjectName, "orders-api-render");
    await act(async () => {
      rendered.container.querySelector<HTMLButtonElement>('button[data-testid="save-target"]')!.click();
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

  it("shows clean deployment target setup errors", async () => {
    const addTarget = jest.fn().mockRejectedValueOnce({
      details: {
        message:
          'Vercel project could not be created: 400 {"error":{"code":"invalid_root_directory","message":"If defined, the Root Directory must be a relative path not starting with `./` and not including `../` or other special characters."}}',
      },
    });
    mockEnvHook({ addTarget });

    const rendered = render(<ProjectEnvPanel project={provisionedProject} />);
    root = rendered.root;

    await act(async () => {
      rendered.container.querySelector<HTMLButtonElement>('button[data-testid="save-target"]')!.click();
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain(
      'Deployment target setup failed: The root directory must be a relative path, for example "frontend". Do not use "./" or "../".',
    );
    expect(rendered.container.textContent).not.toContain("invalid_root_directory");
  });

  it("groups env provisioning into target, variables, and provisioned sections", () => {
    mockEnvHook({
      metadata: [
        {
          id: "meta-1",
          projectId: "project-1",
          deploymentTargetId: "target-1",
          environment: "test",
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

    expect(rendered.container.textContent).toContain("Deployment target");
    expect(rendered.container.textContent).toContain("Variables");
    expect(rendered.container.textContent).toContain("Provisioned variables");
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
          environment: "test",
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
    const keyInput = rendered.container.querySelector<HTMLInputElement>('input[placeholder="DATABASE_URL"]')!;
    const valueInput = rendered.container.querySelector<HTMLInputElement>('input[placeholder="Value"]')!;

    changeValue(keyInput, "DATABASE_URL");
    changeValue(valueInput, "postgres://secret");
    await act(async () => {
      rendered.container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    });

    expect(provision).toHaveBeenCalledWith({
      deploymentTargetId: "target-1",
      environment: "test",
      vars: [{ key: "DATABASE_URL", value: "postgres://secret" }],
    });
    expect(valueInput.value).toBe("");
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

    const textarea = rendered.container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Bulk env text"]')!;
    changeValue(textarea, 'DATABASE_URL=postgres://secret\nAPI_KEY="super-secret"');
    await act(async () => {
      Array.from(rendered.container.querySelectorAll("button"))
        .find((button) => button.textContent === "Validate .env")!
        .click();
      await Promise.resolve();
    });

    expect(validateEnvText).toHaveBeenCalledWith({
      deploymentTargetId: "target-render",
      environment: "test",
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

    const valueInputs = Array.from(rendered.container.querySelectorAll<HTMLInputElement>('input[placeholder="Value"]'));
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
          environment: "test",
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
          environment: "production",
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

    changeValue(rendered.container.querySelector<HTMLSelectElement>('select[aria-label="Filter target"]')!, "target-vercel");
    changeValue(rendered.container.querySelector<HTMLSelectElement>('select[aria-label="Filter environment"]')!, "production");
    changeValue(rendered.container.querySelector<HTMLSelectElement>('select[aria-label="Filter status"]')!, "failed");

    expect(rendered.container.textContent).toContain("API_KEY");
    expect(rendered.container.textContent).not.toContain("DATABASE_URL");
  });

  it("requires confirmation before deleting env metadata", async () => {
    const removeMetadata = jest.fn().mockResolvedValue({ removed: true, key: "DATABASE_URL" });
    mockEnvHook({
      targets: [renderTarget],
      removeMetadata,
      metadata: [
        {
          id: "meta-1",
          projectId: "project-1",
          deploymentTargetId: "target-render",
          environment: "test",
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
          environment: "production",
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

    expect(rendered.container.querySelector<HTMLInputElement>('input[placeholder="DATABASE_URL"]')?.value).toBe("API_KEY");
    const valueInput = rendered.container.querySelector<HTMLInputElement>('input[placeholder="Value"]')!;
    expect(valueInput.value).toBe("");
    expect(rendered.container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);

    changeValue(valueInput, "new-secret");
    await act(async () => {
      rendered.container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await Promise.resolve();
    });

    expect(provision).toHaveBeenCalledWith({
      deploymentTargetId: "target-vercel",
      environment: "production",
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
          environment: "test",
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
