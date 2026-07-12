import {
  createProviderConnection,
  createDeploymentTarget,
  detachDeploymentTarget,
  getCapabilities,
  provisionProjectEnvVars,
  syncDeploymentTarget,
} from "../../src/lib/api/client";

describe("env provisioning API helpers", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it("loads backend capabilities", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        envProvisioning: {
          enabled: true,
          providers: ["render", "vercel"],
          environments: ["test", "uat", "production"],
          modes: ["byo", "flowci_managed"],
        },
      }),
    });

    await expect(getCapabilities()).resolves.toMatchObject({
      envProvisioning: { enabled: true },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/capabilities",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("creates provider connections", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: "connection-1", provider: "render" }),
    });

    await createProviderConnection({
      provider: "render",
      label: "Render main",
      token: "rnd_secret",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/provider-connections",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          provider: "render",
          label: "Render main",
          token: "rnd_secret",
        }),
      }),
    );
  });

  it("creates deployment targets for projects", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: "target-1", provider: "vercel" }),
    });

    await createDeploymentTarget("project-1", {
      action: "create",
      slot: "frontend",
      ownershipMode: "flowci_managed",
      provider: "vercel",
      projectName: "web-test",
      branchName: "test",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/deployment-targets",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("provisions project env vars", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        provisioned: [{ key: "DATABASE_URL", status: "provisioned" }],
        failed: [],
      }),
    });

    await provisionProjectEnvVars("project-1", {
      deploymentTargetId: "target-1",
      environment: "test",
      vars: [{ key: "DATABASE_URL", value: "secret" }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/env-vars/provision",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          deploymentTargetId: "target-1",
          environment: "test",
          vars: [{ key: "DATABASE_URL", value: "secret" }],
        }),
      }),
    );
  });

  it("detaches a deployment target without requesting provider deletion", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        detached: true,
        providerResourceDeleted: false,
      }),
    });

    await expect(
      detachDeploymentTarget("project-1", "target-1"),
    ).resolves.toEqual({
      detached: true,
      providerResourceDeleted: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/deployment-targets/target-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBeUndefined();
  });

  it("detaches a deployment target and opts in to provider resource deletion", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        detached: true,
        providerResourceDeleted: true,
      }),
    });

    await detachDeploymentTarget("project-1", "target-1", {
      deleteProviderResource: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/deployment-targets/target-1",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ deleteProviderResource: true }),
      }),
    );
  });

  it("surfaces a providerDeleteError when opt-in deletion fails on the backend", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        detached: true,
        providerResourceDeleted: false,
        providerDeleteError: "provider API timeout",
      }),
    });

    await expect(
      detachDeploymentTarget("project-1", "target-1", {
        deleteProviderResource: true,
      }),
    ).resolves.toEqual({
      detached: true,
      providerResourceDeleted: false,
      providerDeleteError: "provider API timeout",
    });
  });

  it("syncs a deployment target and reports the provider_live mode with widened severity", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        mode: "provider_live",
        status: "active",
        findings: [
          {
            code: "provider_resource_missing",
            severity: "error",
            message: "The live resource no longer exists.",
          },
        ],
        target: { id: "target-1", provider: "render" },
      }),
    });

    const response = await syncDeploymentTarget("project-1", "target-1");

    expect(response.mode).toBe("provider_live");
    expect(response.findings[0].severity).toBe("error");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/projects/project-1/deployment-targets/target-1/sync",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("syncs a deployment target and reports the local_metadata fallback mode", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        mode: "local_metadata",
        status: "active",
        findings: [
          {
            code: "provider_live_check_failed",
            severity: "warning",
            message: "Could not reach the provider API.",
          },
        ],
        target: { id: "target-1", provider: "vercel" },
      }),
    });

    const response = await syncDeploymentTarget("project-1", "target-1");

    expect(response.mode).toBe("local_metadata");
    expect(
      response.findings.some(
        (finding) => finding.code === "provider_live_check_failed",
      ),
    ).toBe(true);
  });
});
