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
