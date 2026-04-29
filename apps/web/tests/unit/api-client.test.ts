import {
  getGithubAppInstallUrl,
  getLinkedGithubRepos,
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
      json: async () => ({ reposLinked: 2 }),
    });

    await expect(linkGithubInstallation(12345)).resolves.toEqual({ reposLinked: 2 });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/github/installations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ installationId: 12345 }),
      }),
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
