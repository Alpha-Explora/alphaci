import {
  createProject,
  createProviderConnection,
  createSubscriptionCheckout,
  createDeploymentTarget,
  getCheckoutStatus,
  getGithubInstallationAccounts,
  getGithubAppInstallUrl,
  getMyWorkspaces,
  getWorkspaceMembers,
  addWorkspaceMember,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  getNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
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
  getProjectDeployments,
  getProjectDrift,
  getProjectCiRun,
  getProjectCiRuns,
  setupProject,
  syncDeploymentTarget,
  rerunProjectCiRun,
  repairProjectDriftFinding,
  runProjectDriftDetection,
  markNotificationRead,
  listDeploymentTargets,
  listProjectEnvMetadata,
  listProviderConnections,
  provisionProjectEnvVars,
  revokeProviderConnection,
  updateDeploymentTarget,
  validateProjectEnvVars,
  disconnectProject,
  syncProjects,
} from "../../src/lib/api/client";

describe("API client project setup helpers", () => {
  const fetchMock = jest.fn();
  const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

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
        githubCommitUrl: "https://github.com/tone/example-app/commit/commit-sha",
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
            defaultOptions: { lint: true, unit: true, build: true, coverage: true },
          },
        ],
        recipes: [
          {
            id: "frontend-standard-ci",
            label: "Frontend Standard CI",
            supportedProjectTypes: ["nextjs-app"],
            templateByProjectType: { "nextjs-app": "fe-nextjs" },
            supportedOptions: { lint: true, unit: true, build: true, coverage: true },
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
        githubCommitUrl: "https://github.com/tone/example-app/commit/commit-sha",
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
      }),
    });

    await expect(getGithubAppInstallUrl()).resolves.toEqual({
      installUrl: "https://github.com/apps/cicd-example/installations/new",
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
              githubCommitUrl: "https://github.com/tone/example-app/commit/commit-sha",
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

    await expect(getProjects(25, { workspaceId: "workspace-1" })).resolves.toEqual({
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
        workflowName: "FlowCI Quality",
      }),
    });

    await expect(getProjectCiRun("project-1", "local-project-1-quality")).resolves.toMatchObject({
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

    await expect(rerunProjectCiRun("project-1", "local-project-1-quality")).resolves.toMatchObject({
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
        message: "CI token rotated in FlowCI",
        result: { tokenPrefix: "fci_prefix" },
      }),
    });

    await expect(
      repairProjectDriftFinding("project-1", "finding-1", "rotate_ci_token"),
    ).resolves.toMatchObject({
      status: "completed",
      message: "CI token rotated in FlowCI",
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
        items: [{ code: "projects", current: 2, limit: 3, upgradeRequired: false }],
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

  it("loads workspace notification and audit contracts", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          enabled: true,
          items: [{ id: "personal-user-1", name: "Personal", kind: "personal", role: "owner" }],
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
        json: async () => ([{ id: "member-1", role: "owner", login: "tone" }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: "member-2", role: "developer", login: "dev" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "member-2", role: "admin", login: "dev" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "member-2", removed: true }),
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
      items: [{ kind: "personal", role: "owner" }],
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
      { id: "member-1", role: "owner", login: "tone" },
    ]);
    await expect(
      addWorkspaceMember("workspace-1", {
        loginOrEmail: "dev",
        role: "developer",
      }),
    ).resolves.toMatchObject({ id: "member-2", role: "developer" });
    await expect(
      updateWorkspaceMemberRole("workspace-1", "member-2", { role: "admin" }),
    ).resolves.toMatchObject({ id: "member-2", role: "admin" });
    await expect(removeWorkspaceMember("workspace-1", "member-2")).resolves.toEqual({
      id: "member-2",
      removed: true,
    });
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
      "http://localhost:4000/api/v1/workspaces/workspace-1/members",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "http://localhost:4000/api/v1/workspaces/workspace-1/members/member-2",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      "http://localhost:4000/api/v1/workspaces/workspace-1/members/member-2",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      9,
      "http://localhost:4000/api/v1/notifications/preferences",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      10,
      "http://localhost:4000/api/v1/notifications/preferences",
      expect.objectContaining({ method: "PATCH" }),
    );
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

    await expect(updateDeploymentTarget("project-1", "target-1", payload)).resolves.toMatchObject({
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

    await expect(syncDeploymentTarget("project-1", "target-1")).resolves.toMatchObject({
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
        },
      }),
    });

    await expect(getDeploymentTargetActions("project-1", "target-1")).resolves.toMatchObject({
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

  it("detaches a deployment target from FlowCI only", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ detached: true }),
    });

    await expect(detachDeploymentTarget("project-1", "target-1")).resolves.toEqual({
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

    await expect(validateProjectEnvVars("project-1", payload)).resolves.toEqual({
      keyCount: 1,
      keys: ["DATABASE_URL"],
      duplicates: [],
      invalidKeys: [],
      warnings: [],
    });

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
        json: async () => ([
          { id: "connection-1", provider: "render", status: "active" },
        ]),
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
        json: async () => ([{ id: "target-1", provider: "render" }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: "target-2", provider: "vercel" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ([{ id: "meta-1", key: "DATABASE_URL" }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ provisioned: [{ key: "DATABASE_URL" }], failed: [] }),
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
    await expect(revokeProviderConnection("connection/2")).resolves.toEqual({ revoked: true });
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

    await expect(deleteProjectEnvMetadata("project-1", "meta-1")).resolves.toEqual({
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

    await expect(disconnectProject("project/1")).resolves.toBeUndefined();
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
            name: "FlowCI Access Gate",
            path: ".github/workflows/00-flowci-access.yml",
            gated: true,
            yaml: "name: FlowCI Access Gate",
          },
        ],
        diffSummary: [
          {
            path: ".github/workflows/00-flowci-access.yml",
            status: "changed",
          },
        ],
        validationWarnings: [],
      }),
    });

    await expect(previewWorkflowSettings("project-1", payload)).resolves.toMatchObject({
      workflowFiles: [
        expect.objectContaining({
          path: ".github/workflows/00-flowci-access.yml",
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
        branchName: "flowci/workflow-update-20260612000000",
        workflowPath: ".github/workflows/00-flowci-access.yml",
        workflowFiles: [],
        pullRequestNumber: 42,
        pullRequestUrl: "https://github.com/tone/example-app/pull/42",
        status: "created",
      }),
    });

    await expect(createWorkflowUpdatePullRequest("project-1", payload)).resolves.toMatchObject({
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

  it("creates a subscription checkout session", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        checkoutId: "cs_paymongo_123",
        status: "active",
        redirectUrl: "https://checkout.paymongo.com/cs_paymongo_123",
      }),
    });

    await expect(createSubscriptionCheckout("pro")).resolves.toEqual({
      checkoutId: "cs_paymongo_123",
      status: "active",
      redirectUrl: "https://checkout.paymongo.com/cs_paymongo_123",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/subscription/checkout",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ plan: "pro" }),
      }),
    );
  });

  it("loads subscription checkout status", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: "paid",
        subscription: {
          plan: "pro",
          status: "active",
          provider: "paymongo",
          updatedAt: "2026-06-05T00:00:00.000Z",
        },
      }),
    });

    await expect(getCheckoutStatus("cs_paymongo_123")).resolves.toMatchObject({
      status: "paid",
      subscription: { provider: "paymongo" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/subscription/checkout/cs_paymongo_123/status",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("accepts NEXT_PUBLIC_API_URL and appends the API prefix", async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:4500";
    jest.resetModules();

    const { getApiBaseUrl } = await import("../../src/lib/api/client");

    expect(getApiBaseUrl()).toBe("http://127.0.0.1:4500/api/v1");
  });
});
