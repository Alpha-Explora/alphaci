import {
  createProviderConnection,
  createDeploymentTarget,
  getCapabilities,
  provisionProjectEnvVars,
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
});
