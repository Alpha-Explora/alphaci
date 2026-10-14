import {
  defaultProvisioningTarget,
  reseedTargets,
  targetNameLabel,
  variableLaneLabel,
} from "../../../../../../src/features/workflows/studio/model/deployment-provisioning-rules";

describe("defaultProvisioningTarget", () => {
  it("starts a backend on managed Render with today's defaults", () => {
    expect(defaultProvisioningTarget("backend", "ledger", "standalone")).toEqual({
      slot: "backend",
      provider: "render",
      ownershipMode: "flowci_managed",
      projectName: "ledger",
      branchName: "uat",
      rootDirectory: ".",
      buildCommand: "npm ci && npm run build",
      startCommand: "npm run start:prod",
      renderDeployMethod: "native_git",
      renderServiceType: "web_service",
      renderRuntime: "docker",
      renderInstanceType: "free",
      env: [{ lane: "preview", vars: [] }],
    });
  });

  it("starts a frontend on Vercel, under frontend/ only for microservices", () => {
    expect(defaultProvisioningTarget("frontend", "web", "multi")).toMatchObject({
      provider: "vercel",
      rootDirectory: ".",
      buildCommand: "npm run build",
      startCommand: undefined,
    });
    expect(defaultProvisioningTarget("frontend", "web", "microservices").rootDirectory).toBe("frontend");
  });
});

describe("reseedTargets", () => {
  const seeded = [defaultProvisioningTarget("backend", "orders", "standalone")];

  it("renames a target nobody renamed, keeping what was typed into it", () => {
    const typed = [
      {
        ...seeded[0]!,
        renderRegion: "frankfurt",
        env: [{ lane: "preview" as const, vars: [{ key: "DATABASE_URL", value: "x" }] }],
      },
    ];
    const next = reseedTargets(
      typed,
      [{ slot: "backend", projectName: "orders" }],
      [{ slot: "backend", projectName: "orders-api" }],
      "standalone",
    );
    expect(next[0]).toEqual({ ...typed[0], projectName: "orders-api" });
  });

  it("keeps a name the person changed", () => {
    const renamed = [{ ...seeded[0]!, projectName: "my-service" }];
    expect(
      reseedTargets(
        renamed,
        [{ slot: "backend", projectName: "orders" }],
        [{ slot: "backend", projectName: "orders-api" }],
      )[0]?.projectName,
    ).toBe("my-service");
  });

  it("starts over when the slots change (another stack or shape)", () => {
    expect(
      reseedTargets(
        seeded,
        [{ slot: "backend", projectName: "orders" }],
        [{ slot: "frontend", projectName: "orders" }],
        "standalone",
      ),
    ).toEqual([defaultProvisioningTarget("frontend", "orders", "standalone")]);
  });
});

describe("card labels", () => {
  it("names the variables lane and the provider's own word for the name", () => {
    const render = defaultProvisioningTarget("backend", "x");
    const vercel = defaultProvisioningTarget("frontend", "x");
    expect(variableLaneLabel("preview", render)).toBe("uat branch");
    expect(variableLaneLabel("production", render)).toBe("Production");
    expect(targetNameLabel(render)).toBe("Service name");
    expect(targetNameLabel(vercel)).toBe("Project name");
  });
});
