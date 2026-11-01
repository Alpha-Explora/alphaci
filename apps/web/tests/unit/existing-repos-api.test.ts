import {
  discoverExistingRepo,
  setupExistingRepoPullRequest,
} from "@/features/workflows/studio/data/existing-repos-api";

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

describe("existing repo API client", () => {
  it("posts discovery requests to the existing repos endpoint", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        repoFullName: "tone/app",
        baseBranch: "main",
        detectedProjectTypeId: "nextjs",
        recommendedWorkflowRecipeId: "standard",
        serviceName: "app",
        servicePath: ".",
      }),
    });

    const result = await discoverExistingRepo({
      repoFullName: "tone/app",
      baseBranch: "main",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/existing-repos/discover",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ repoFullName: "tone/app", baseBranch: "main" }),
      }),
    );
    expect(result.detectedProjectTypeId).toBe("nextjs");
  });

  /* The branch is optional on the wire so the server can ask the repository
   * which branch it lives on. Sending a "main" default instead of omitting the
   * field suppressed that lookup, and a repo on `master` was scanned on a
   * branch it does not have — no package.json, so no detected project type. */
  it("omits baseBranch entirely when the caller does not pin one", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        repoFullName: "tone/app",
        baseBranch: "master",
        detectedProjectTypeId: "nextjs",
        recommendedWorkflowRecipeId: "standard",
        serviceName: "app",
        servicePath: ".",
        warnings: [],
      }),
    });

    const result = await discoverExistingRepo({ repoFullName: "tone/app" });

    const body = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as { body: string }).body,
    ) as Record<string, unknown>;
    expect(body).not.toHaveProperty("baseBranch");
    // The server answers with the branch it actually scanned.
    expect(result.baseBranch).toBe("master");
  });

  it("posts setup PR requests to the existing repos endpoint", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        repoFullName: "tone/app",
        branchName: "alphaci/app-ci",
        workflowPath: ".github/workflows/ci.yml",
        pullRequestNumber: 42,
        pullRequestUrl: "https://github.com/tone/app/pull/42",
      }),
    });

    const result = await setupExistingRepoPullRequest({
      repoFullName: "tone/app",
      baseBranch: "main",
      projectTypeId: "nextjs",
      workflowRecipeId: "standard",
      serviceName: "app",
      servicePath: ".",
      outputFileName: "ci.yml",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/existing-repos/setup-pr",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          repoFullName: "tone/app",
          baseBranch: "main",
          projectTypeId: "nextjs",
          workflowRecipeId: "standard",
          serviceName: "app",
          servicePath: ".",
          outputFileName: "ci.yml",
        }),
      }),
    );
    expect(result.pullRequestUrl).toBe("https://github.com/tone/app/pull/42");
  });
});
