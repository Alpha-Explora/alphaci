import { projectsRepository } from "../../src/features/projects/data/projects-repository";
import {
  createProject,
  createProviderConnection,
  createDeploymentTarget,
  getGithubInstallationAccounts,
  getGithubAppInstallUrl,
  getMyWorkspaces,
  getWorkspaceMembers,
  getLinkedGithubRepos,
  getMyUsage,
  getProjectAuditEvents,
  getProjectOverview,
  getProjectOptions,
  getProjects,
  getWorkflowSettings,
  syncProjectSnapshot,
  linkGithubInstallation,
  previewWorkflowSettings,
  createWorkflowUpdatePullRequest,
  deleteProjectEnvMetadata,
  detachDeploymentTarget,
  getDeploymentTargetActions,
  reinstallDeploymentSecrets,
  getProjectDeployments,
  getProjectDrift,
  getProjectCiRun,
  getProjectCiRuns,
  setupProject,
  syncDeploymentTarget,
  rerunProjectCiRun,
  repairProjectDriftFinding,
  runProjectDriftDetection,
  listDeploymentTargets,
  listProjectEnvMetadata,
  listProviderConnections,
  provisionProjectEnvVars,
  revokeProviderConnection,
  updateDeploymentTarget,
  validateProjectEnvVars,
  disconnectProject,
  syncProjects,
} from "../support/api-client";
import { notificationsRepository } from "../../src/features/notifications/data/notifications-repository";

const getNotifications = notificationsRepository.list;
const markNotificationRead = notificationsRepository.markRead;
const getNotificationPreferences = notificationsRepository.getPreferences;
const updateNotificationPreferences = notificationsRepository.updatePreferences;

describe("API client project setup helpers", () => {
  const fetchMock = jest.fn();
  const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    if (originalApiBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }

    if (originalApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    jest.resetModules();
  });

  it("posts project setup payload to the setup endpoint", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: "project-1",
        repoFullName: "tone/example-app",
        status: "provisioned",
        workflowPath: ".github/workflows/example.yml",
        githubCommitSha: "commit-sha",
        githubCommitUrl:
          "https://github.com/tone/example-app/commit/commit-sha",
      }),
    });

    await expect(
      setupProject({
        repoFullName: "tone/example-app",
        templateId: "frontend-react",
        serviceName: "example-app",
        nodeVersion: "24",
        coverageThreshold: 80,
        enhancements: ["disableK6"],
        outputFileName: "example.yml",
      }),
    ).resolves.toMatchObject({
      workflowPath: ".github/workflows/example.yml",
      githubCommitSha: "commit-sha",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/setup",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          repoFullName: "tone/example-app",
          templateId: "frontend-react",
          serviceName: "example-app",
          nodeVersion: "24",
          coverageThreshold: 80,
          enhancements: ["disableK6"],
          outputFileName: "example.yml",
        }),
      }),
    );
  });

  it("loads catalog-driven project options", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        repoShapes: [{ id: "single-app", label: "Single App", enabled: true }],
        projectTypes: [
          {
            id: "nextjs-app",
            label: "Next.js App",
            language: "typescript",
            framework: "nextjs",
            repoShapes: ["single-app"],
            defaultRecipe: "frontend-standard-ci",
            allowedRecipes: ["frontend-standard-ci"],
            defaultOptions: {
              lint: true,
              unit: true,
              build: true,
              coverage: true,
            },
          },
        ],
        recipes: [
          {
            id: "frontend-standard-ci",
            label: "Frontend Standard CI",
            supportedProjectTypes: ["nextjs-app"],
            templateByProjectType: { "nextjs-app": "fe-nextjs" },
            supportedOptions: {
              lint: true,
              unit: true,
              build: true,
              coverage: true,
            },
            optionJobs: { lint: "lint", unit: "unit-tests" },
          },
        ],
      }),
    });

    await expect(getProjectOptions()).resolves.toMatchObject({
      repoShapes: [{ id: "single-app", enabled: true }],
      projectTypes: [{ id: "nextjs-app" }],
      recipes: [{ id: "frontend-standard-ci" }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/catalog/project-options",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("preserves plain text API error details", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => "No fixture for /projects",
    });

    await expect(getProjects()).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      details: "No fixture for /projects",
    });
  });

  it("creates a new GitHub project from a catalog payload", async () => {
    const payload = {
      repoName: "example-app",
      visibility: "private" as const,
      repoShape: "single-app",
      projectTypeId: "nextjs-app",
      workflowRecipeId: "frontend-standard-ci",
      serviceName: "example-app",
      servicePath: ".",
      nodeVersion: "24",
      coverageThreshold: 80,
      tests: {
        lint: true,
        unit: true,
        build: true,
        coverage: true,
        security: true,
        docker: false,
      },
      outputFileName: "ci.yml",
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        id: "project-1",
        repoFullName: "tone/example-app",
        repoUrl: "https://github.com/tone/example-app",
        status: "provisioned",
        workflowPath: ".github/workflows/ci.yml",
        githubCommitSha: "commit-sha",
        githubCommitUrl:
          "https://github.com/tone/example-app/commit/commit-sha",
        projectTypeId: "nextjs-app",
        workflowRecipeId: "frontend-standard-ci",
      }),
    });

    await expect(createProject(payload)).resolves.toMatchObject({
      repoUrl: "https://github.com/tone/example-app",
      workflowPath: ".github/workflows/ci.yml",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  });

  it("gets the GitHub App install URL", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        installUrl: "https://github.com/apps/cicd-example/installations/new",
        appSlug: "cicd-example",
      }),
    });

    await expect(getGithubAppInstallUrl()).resolves.toEqual({
      installUrl: "https://github.com/apps/cicd-example/installations/new",
      appSlug: "cicd-example",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/github/app/install-url",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("links a GitHub App installation id", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ reposLinked: 2, repositorySelection: "all" }),
    });

    await expect(linkGithubInstallation(12345)).resolves.toEqual({
      reposLinked: 2,
      repositorySelection: "all",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/github/installations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ installationId: 12345 }),
      }),
    );
  });

  it("loads GitHub App installation accounts", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        accounts: [
          {
            installationId: 12345,
            accountLogin: "tone",
            accountId: 999,
            repositorySelection: "all",
          },
        ],
      }),
    });

    await expect(getGithubInstallationAccounts()).resolves.toEqual({
      accounts: [
        {
          installationId: 12345,
          accountLogin: "tone",
          accountId: 999,
          repositorySelection: "all",
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/github/installations/accounts",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("loads linked GitHub App repos and provisioned projects", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          repos: [{ installationId: 12345, repoFullName: "tone/example-app" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: "project-1",
              repoFullName: "tone/example-app",
              repoUrl: "https://github.com/tone/example-app",
              visibility: "private",
              repoShape: "single-app",
              projectTypeId: "nextjs-app",
              workflowRecipeId: "frontend-standard-ci",
              projectOptions: { lint: true, unit: true, build: true },
              templateId: "frontend-react",
              serviceName: "example-app",
              workflowPath: ".github/workflows/example.yml",
              status: "provisioned",
              githubCommitSha: "commit-sha",
              githubCommitUrl:
                "https://github.com/tone/example-app/commit/commit-sha",
              failureReason: null,
            },
          ],
        }),
      });

    await expect(getLinkedGithubRepos()).resolves.toEqual({
      repos: [{ installationId: 12345, repoFullName: "tone/example-app" }],
    });
    await expect(getProjects(25)).resolves.toMatchObject({
      items: [{ id: "project-1", status: "provisioned" }],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4000/api/v1/github/installations/repos",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/v1/projects?limit=25",
      expect.any(Object),
    );
  });

  it("loads provisioned projects for a selected workspace", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    });

    await expect(
      getProjects(25, { workspaceId: "workspace-1" }),
    ).resolves.toEqual({
      items: [],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects?limit=25&workspaceId=workspace-1",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("uses the default project list limit when no limit is provided", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    });

    await expect(getProjects()).resolves.toEqual({ items: [] });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects?limit=25",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("loads a project overview", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        project: { id: "project-1", repoFullName: "tone/example-app" },
        workflow: { files: [], stageCount: 0, history: [] },
        deploymentTargets: { items: [], count: 0 },
        environment: { items: [], count: 0, failedCount: 0 },
        ciAuth: { status: "missing", tokenPresent: false },
        health: { summary: "warning", checks: [] },
        syncSnapshot: { enabled: true, mode: "local_snapshot", latest: null },
        capabilities: { envProvisioning: true },
      }),
    });

    await expect(getProjectOverview("project-1")).resolves.toMatchObject({
      project: { id: "project-1" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/overview",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("loads project CI runs", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        enabled: true,
        mode: "local_mock",
        liveGithubEnabled: false,
        githubActionsUrl: "https://github.com/tone/orders-api/actions",
        runs: [],
      }),
    });

    await expect(getProjectCiRuns("project-1")).resolves.toMatchObject({
      mode: "local_mock",
      runs: [],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/ci-runs",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("loads project CI run detail", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: "local-project-1-quality",
        stage: "quality",
        workflowName: "ALPHACI Quality",
      }),
    });

    await expect(
      getProjectCiRun("project-1", "local-project-1-quality"),
    ).resolves.toMatchObject({
      id: "local-project-1-quality",
      stage: "quality",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/ci-runs/local-project-1-quality",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("requests a CI run rerun and receives disabled local state", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        enabled: false,
        runId: "local-project-1-quality",
        reason: "Live GitHub run sync is not enabled",
      }),
    });

    await expect(
      rerunProjectCiRun("project-1", "local-project-1-quality"),
    ).resolves.toMatchObject({
      enabled: false,
      reason: "Live GitHub run sync is not enabled",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/ci-runs/local-project-1-quality/rerun",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
      }),
    );
  });

  it("loads project deployment history", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        enabled: true,
        mode: "local_mock",
        liveProvidersEnabled: false,
        deployments: [],
      }),
    });

    await expect(getProjectDeployments("project-1")).resolves.toMatchObject({
      mode: "local_mock",
      deployments: [],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/deployments",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("loads and runs project drift detection", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          enabled: true,
          mode: "local_snapshot",
          findings: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          enabled: true,
          mode: "local_snapshot",
          findings: [{ id: "finding-1", code: "ci_token_missing" }],
        }),
      });

    await expect(getProjectDrift("project-1")).resolves.toMatchObject({
      mode: "local_snapshot",
      findings: [],
    });
    await expect(runProjectDriftDetection("project-1")).resolves.toMatchObject({
      findings: [{ code: "ci_token_missing" }],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4000/api/v1/projects/project-1/drift",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/v1/projects/project-1/drift/run",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
      }),
    );
  });

  it("repairs a project drift finding with an explicit action", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        enabled: true,
        mode: "local_safe",
        findingId: "finding-1",
        action: "rotate_ci_token",
        status: "completed",
        message: "CI token rotated in ALPHACI",
        result: { tokenPrefix: "aci_prefix" },
      }),
    });

    await expect(
      repairProjectDriftFinding("project-1", "finding-1", "rotate_ci_token"),
    ).resolves.toMatchObject({
      status: "completed",
      message: "CI token rotated in ALPHACI",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/drift/finding-1/repair",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        body: JSON.stringify({ action: "rotate_ci_token" }),
      }),
    );
  });

  it("loads current usage limits", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        enabled: true,
        plan: "free",
        items: [
          { code: "projects", current: 2, limit: 3, upgradeRequired: false },
        ],
      }),
    });

    await expect(getMyUsage()).resolves.toMatchObject({
      plan: "free",
      items: [{ code: "projects", current: 2, limit: 3 }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/usage/me",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("pages the audit trail with ?limit and ?before, passing the cursor back unchanged", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ enabled: true, items: [], next: null }),
    });
    const cursor = "2026-10-01T12:00:00.123456+00:00";
    await getProjectAuditEvents("project-1", { limit: 50, before: cursor });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/api/v1/projects/project-1/audit");
    expect(url.searchParams.get("limit")).toBe("50");
    expect(url.searchParams.get("before")).toBe(cursor);
  });

  it("loads workspace notification and audit contracts", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          enabled: true,
          items: [
            {
              id: "personal-user-1",
              name: "Personal",
              kind: "team",
              role: "admin",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ enabled: true, items: [], unreadCount: 0 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: "notification-1", read: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ enabled: true, items: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ id: "member-1", role: "admin", login: "tone" }],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          userId: "user-1",
          inAppEnabled: true,
          emailEnabled: false,
          updatedAt: "2026-06-15T00:00:00.000Z",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          userId: "user-1",
          inAppEnabled: false,
          emailEnabled: false,
          updatedAt: "2026-06-15T00:01:00.000Z",
        }),
      });

    await expect(getMyWorkspaces()).resolves.toMatchObject({
      items: [{ kind: "team", role: "admin" }],
    });
    await expect(getNotifications()).resolves.toMatchObject({ unreadCount: 0 });
    await expect(markNotificationRead("notification-1")).resolves.toEqual({
      id: "notification-1",
      read: true,
    });
    await expect(getProjectAuditEvents("project-1")).resolves.toMatchObject({
      items: [],
    });
    await expect(getWorkspaceMembers("workspace-1")).resolves.toEqual([
      { id: "member-1", role: "admin", login: "tone" },
    ]);
    await expect(getNotificationPreferences()).resolves.toMatchObject({
      inAppEnabled: true,
    });
    await expect(
      updateNotificationPreferences({ inAppEnabled: false }),
    ).resolves.toMatchObject({ inAppEnabled: false });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4000/api/v1/workspaces/me",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/v1/notifications",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:4000/api/v1/notifications/notification-1/read",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:4000/api/v1/projects/project-1/audit",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:4000/api/v1/workspaces/workspace-1/members",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "http://localhost:4000/api/v1/notifications/preferences",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "http://localhost:4000/api/v1/notifications/preferences",
      expect.objectContaining({ method: "PATCH" }),
    );
    // The roster is read-only here: no member write goes to /workspaces/:id/members.
    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) =>
          String(url).includes("/workspaces/workspace-1/members") &&
          (init as RequestInit | undefined)?.method !== undefined &&
          (init as RequestInit).method !== "GET",
      ),
    ).toEqual([]);
  });

  it("runs a local project sync snapshot", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        snapshot: {
          id: "snapshot-1",
          projectId: "project-1",
          status: "warning",
          summary: { mode: "local_snapshot" },
          findings: [{ code: "ci_token_missing" }],
        },
        overview: {
          project: { id: "project-1", repoFullName: "tone/example-app" },
          syncSnapshot: {
            enabled: true,
            mode: "local_snapshot",
            latest: { id: "snapshot-1", status: "warning" },
          },
        },
      }),
    });

    await expect(syncProjectSnapshot("project-1")).resolves.toMatchObject({
      snapshot: { id: "snapshot-1", status: "warning" },
      overview: { syncSnapshot: { mode: "local_snapshot" } },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/sync",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
      }),
    );
  });

  it("updates deployment target metadata", async () => {
    const payload = {
      providerProjectName: "orders-api-uat",
      branchName: "uat",
      rootDirectory: "apps/api",
      buildCommand: "npm run build",
      startCommand: "npm run start:prod",
      slot: "backend" as const,
      renderEnvironmentName: "uat" as const,
    };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: "target-1",
        providerProjectName: "orders-api-uat",
        branchName: "uat",
      }),
    });

    await expect(
      updateDeploymentTarget("project-1", "target-1", payload),
    ).resolves.toMatchObject({
      id: "target-1",
      branchName: "uat",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/deployment-targets/target-1",
      expect.objectContaining({
        credentials: "include",
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    );
  });

  it("syncs a deployment target from local metadata", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        mode: "local_metadata",
        status: "active",
        findings: [],
        target: { id: "target-1" },
      }),
    });

    await expect(
      syncDeploymentTarget("project-1", "target-1"),
    ).resolves.toMatchObject({
      mode: "local_metadata",
      target: { id: "target-1" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/deployment-targets/target-1/sync",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
      }),
    );
  });

  it("loads deployment target actions", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        targetId: "target-1",
        provider: "vercel",
        actions: {
          sync: { enabled: true, mode: "local_metadata" },
          detach: { enabled: true },
          reinstallDeploymentSecrets: {
            enabled: false,
            reason: "Provider activation required",
          },
          openProviderDashboard: {
            enabled: true,
            url: "https://vercel.com/flowci-team/orders-web",
          },
          openProviderConsole: {
            enabled: true,
            url: "https://vercel.com/flowci-team/orders-web/deployments",
          },
        },
      }),
    });

    await expect(
      getDeploymentTargetActions("project-1", "target-1"),
    ).resolves.toMatchObject({
      targetId: "target-1",
      actions: {
        reinstallDeploymentSecrets: {
          enabled: false,
        },
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/deployment-targets/target-1/actions",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("reinstalls a deployment target's GitHub Actions secrets", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        reinstalled: true,
        githubSecrets: { renderDeployHook: "RENDER_DEPLOY_HOOK_URL" },
        githubVariables: { vercelTestBypass: "VERCEL_TEST_BYPASS_TOKEN" },
      }),
    });

    await expect(
      reinstallDeploymentSecrets("project-1", "target-1"),
    ).resolves.toMatchObject({
      reinstalled: true,
      githubSecrets: { renderDeployHook: "RENDER_DEPLOY_HOOK_URL" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/deployment-targets/target-1/reinstall-secrets",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
      }),
    );
  });

  it("detaches a deployment target from ALPHACI only", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ detached: true }),
    });

    await expect(
      detachDeploymentTarget("project-1", "target-1"),
    ).resolves.toEqual({
      detached: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/deployment-targets/target-1",
      expect.objectContaining({
        credentials: "include",
        method: "DELETE",
      }),
    );
  });

  it("validates bulk env text without returning values", async () => {
    const payload = {
      deploymentTargetId: "target-1",
      environment: "test" as const,
      text: "DATABASE_URL=postgres://secret",
    };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        keyCount: 1,
        keys: ["DATABASE_URL"],
        duplicates: [],
        invalidKeys: [],
        warnings: [],
      }),
    });

    await expect(validateProjectEnvVars("project-1", payload)).resolves.toEqual(
      {
        keyCount: 1,
        keys: ["DATABASE_URL"],
        duplicates: [],
        invalidKeys: [],
        warnings: [],
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/env-vars/validate",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  });

  it("covers provider connection and deployment target route helpers", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          { id: "connection-1", provider: "render", status: "active" },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: "connection-2", provider: "vercel" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ revoked: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ id: "target-1", provider: "render" }],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: "target-2", provider: "vercel" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ id: "meta-1", key: "DATABASE_URL" }],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          provisioned: [{ key: "DATABASE_URL" }],
          failed: [],
        }),
      });

    await expect(listProviderConnections()).resolves.toEqual([
      { id: "connection-1", provider: "render", status: "active" },
    ]);
    await expect(
      createProviderConnection({
        provider: "vercel",
        label: "Vercel team",
        token: "secret",
      }),
    ).resolves.toMatchObject({ id: "connection-2" });
    await expect(revokeProviderConnection("connection/2")).resolves.toEqual({
      revoked: true,
    });
    await expect(listDeploymentTargets("project/1")).resolves.toEqual([
      { id: "target-1", provider: "render" },
    ]);
    await expect(
      createDeploymentTarget("project/1", {
        action: "create",
        slot: "frontend",
        ownershipMode: "flowci_managed",
        provider: "vercel",
        projectName: "web",
        branchName: "test",
      }),
    ).resolves.toMatchObject({ id: "target-2" });
    await expect(listProjectEnvMetadata("project/1")).resolves.toEqual([
      { id: "meta-1", key: "DATABASE_URL" },
    ]);
    await expect(
      provisionProjectEnvVars("project/1", {
        deploymentTargetId: "target-2",
        environment: "test",
        vars: [{ key: "DATABASE_URL", value: "postgres://secret" }],
      }),
    ).resolves.toMatchObject({ provisioned: [{ key: "DATABASE_URL" }] });

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:4000/api/v1/provider-connections/connection%2F2",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:4000/api/v1/projects/project%2F1/deployment-targets",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:4000/api/v1/projects/project%2F1/deployment-targets",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "http://localhost:4000/api/v1/projects/project%2F1/env-vars/provision",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("deletes env metadata by id", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ removed: true, key: "DATABASE_URL" }),
    });

    await expect(
      deleteProjectEnvMetadata("project-1", "meta-1"),
    ).resolves.toEqual({
      removed: true,
      key: "DATABASE_URL",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/env-vars/meta-1",
      expect.objectContaining({
        credentials: "include",
        method: "DELETE",
      }),
    );
  });

  it("disconnects projects and syncs reachable project state", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ orphaned: 1, reachable: 3, total: 4 }),
      });

    await expect(disconnectProject("project/1")).resolves.toEqual({
      ok: true,
    });
    await expect(syncProjects()).resolves.toEqual({
      orphaned: 1,
      reachable: 3,
      total: 4,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4000/api/v1/projects/project%2F1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/v1/projects/sync",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("disconnects a project with deleteGithubRepo opt-in and reports full success", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, githubRepoDeleted: true }),
    });

    await expect(
      disconnectProject("project/1", {
        deleteGithubRepo: true,
        confirmRepoName: "acme/project-1",
      }),
    ).resolves.toEqual({ ok: true, githubRepoDeleted: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project%2F1",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({
          deleteGithubRepo: true,
          confirmRepoName: "acme/project-1",
        }),
      }),
    );
  });

  it("sends only the deletions the user ticked, with the typed repo name for GitHub", async () => {
    const ok = () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, githubRepoDeleted: false }),
    });
    fetchMock.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok());

    await projectsRepository.disconnect(
      "project-1",
      {
        deleteGithubRepo: false,
        deleteProviderResources: true,
        deleteSonarProject: true,
      },
      "acme/project-1",
    );
    await projectsRepository.disconnect(
      "project-1",
      {
        deleteGithubRepo: false,
        deleteProviderResources: false,
        deleteSonarProject: false,
      },
      "acme/project-1",
    );

    const [, withOptIns] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(withOptIns.body))).toEqual({
      deleteProviderResources: true,
      deleteSonarProject: true,
    });
    const [, plain] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(plain.body).toBeUndefined();
  });

  it("resolves a generic githubRepoDeleteError when GitHub deletion fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        githubRepoDeleted: false,
        githubRepoDeleteError: {
          code: "other",
          message: "GitHub API returned a 500 error.",
        },
      }),
    });

    await expect(
      disconnectProject("project/1", {
        deleteGithubRepo: true,
        confirmRepoName: "acme/project-1",
      }),
    ).resolves.toEqual({
      ok: true,
      githubRepoDeleted: false,
      githubRepoDeleteError: {
        code: "other",
        message: "GitHub API returned a 500 error.",
      },
    });
  });

  it("resolves a missing_scope githubRepoDeleteError when the GitHub App lacks delete permission", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        githubRepoDeleted: false,
        githubRepoDeleteError: {
          code: "missing_scope",
          message: "The GitHub App installation is missing delete_repo scope.",
        },
      }),
    });

    await expect(
      disconnectProject("project/1", {
        deleteGithubRepo: true,
        confirmRepoName: "acme/project-1",
      }),
    ).resolves.toEqual({
      ok: true,
      githubRepoDeleted: false,
      githubRepoDeleteError: {
        code: "missing_scope",
        message: "The GitHub App installation is missing delete_repo scope.",
      },
    });
  });

  it("loads workflow settings for a project", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        enabled: true,
        source: "project_options",
        settings: {
          projectId: "project-1",
          templateId: "be-nestjs",
          serviceName: "orders-api",
          servicePath: ".",
          nodeVersion: "24",
          packageManager: "npm",
          coverageThreshold: 80,
          centralWorkflowRef: "v1",
          checks: { lint: true, unit: true, build: true, security: true },
        },
      }),
    });

    await expect(getWorkflowSettings("project-1")).resolves.toMatchObject({
      settings: { nodeVersion: "24", packageManager: "npm" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/workflow-settings",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("previews workflow settings without a GitHub write route", async () => {
    const payload = { nodeVersion: "22", coverageThreshold: 90 };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        settings: {
          projectId: "project-1",
          nodeVersion: "22",
          coverageThreshold: 90,
        },
        workflowFiles: [
          {
            stage: "access",
            name: "ALPHACI Access Gate",
            path: ".github/workflows/00-alphaci-access.yml",
            gated: true,
            yaml: "name: ALPHACI Access Gate",
          },
        ],
        diffSummary: [
          {
            path: ".github/workflows/00-alphaci-access.yml",
            status: "changed",
          },
        ],
        validationWarnings: [],
      }),
    });

    await expect(
      previewWorkflowSettings("project-1", payload),
    ).resolves.toMatchObject({
      workflowFiles: [
        expect.objectContaining({
          path: ".github/workflows/00-alphaci-access.yml",
        }),
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/workflow-settings/preview",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  });

  it("creates a workflow update pull request", async () => {
    const payload = { nodeVersion: "22", coverageThreshold: 90 };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        projectId: "project-1",
        repoFullName: "tone/example-app",
        branchName: "alphaci/workflow-update-20260612000000",
        workflowPath: ".github/workflows/00-alphaci-access.yml",
        workflowFiles: [],
        pullRequestNumber: 42,
        pullRequestUrl: "https://github.com/tone/example-app/pull/42",
        status: "created",
      }),
    });

    await expect(
      createWorkflowUpdatePullRequest("project-1", payload),
    ).resolves.toMatchObject({
      pullRequestNumber: 42,
      pullRequestUrl: "https://github.com/tone/example-app/pull/42",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/workflow-settings/pr",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  });

  it("keeps a relative base for the same-origin proxy (API_PROXY_TARGET)", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "/api/v1";
    process.env.NODE_ENV = "production";
    jest.resetModules();

    const { getApiBaseUrl } = await import("../support/api-client");

    expect(getApiBaseUrl()).toBe("/api/v1");
  });

  it("accepts NEXT_PUBLIC_API_URL for non-production local development", async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:4500";
    process.env.NODE_ENV = "test";
    jest.resetModules();

    const { getApiBaseUrl } = await import("../support/api-client");

    expect(getApiBaseUrl()).toBe("http://127.0.0.1:4500/api/v1");
  });

  it("falls back to the legacy API alias in production but warns (no throw)", async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.NEXT_PUBLIC_API_URL = "https://flowci-be-test.onrender.com";
    process.env.NODE_ENV = "production";
    jest.resetModules();

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { getApiBaseUrl } = await import("../support/api-client");
      expect(getApiBaseUrl()).toBe(
        "https://flowci-be-test.onrender.com/api/v1",
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("NEXT_PUBLIC_API_URL is a legacy alias"),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("loudly errors (but does not throw) when no API URL is set in production", async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    process.env.NODE_ENV = "production";
    jest.resetModules();

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { getApiBaseUrl } = await import("../support/api-client");
      // Build must not crash — it degrades to localhost...
      expect(getApiBaseUrl()).toBe("http://localhost:4000/api/v1");
      // ...but the misconfiguration is surfaced loudly for the operator.
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Neither NEXT_PUBLIC_API_BASE_URL"),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("prefers NEXT_PUBLIC_API_BASE_URL over the legacy alias in production", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL =
      "https://alphaci-be-test.onrender.com";
    process.env.NEXT_PUBLIC_API_URL = "https://flowci-be-test.onrender.com";
    process.env.NODE_ENV = "production";
    jest.resetModules();

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { getApiBaseUrl } = await import("../support/api-client");
      expect(getApiBaseUrl()).toBe(
        "https://alphaci-be-test.onrender.com/api/v1",
      );
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
