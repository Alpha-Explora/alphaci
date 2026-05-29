import {
  createProject,
  getGithubInstallationAccounts,
  getGithubAppInstallUrl,
  getLinkedGithubRepos,
  getProjectOptions,
  getProjects,
  linkGithubInstallation,
  setupProject,
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

  it("accepts NEXT_PUBLIC_API_URL and appends the API prefix", async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:4500";
    jest.resetModules();

    const { getApiBaseUrl } = await import("../../src/lib/api/client");

    expect(getApiBaseUrl()).toBe("http://127.0.0.1:4500/api/v1");
  });
});
