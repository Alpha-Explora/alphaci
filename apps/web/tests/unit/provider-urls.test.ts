import type { DeploymentTarget } from "../../src/lib/api/contracts";
import {
  providerConsoleUrl,
  providerDashboardUrl,
  providerDisplayName,
} from "../../src/lib/hosting/provider-urls";

function target(overrides: Partial<DeploymentTarget>): DeploymentTarget {
  return {
    id: "target-1",
    projectId: "project-1",
    slot: "backend",
    ownershipMode: "flowci_managed",
    provider: "render",
    providerConnectionId: null,
    providerProjectId: "srv-1",
    providerProjectName: "orders-api",
    repoFullName: "tone/orders-api",
    branchName: "test",
    rootDirectory: ".",
    buildCommand: null,
    startCommand: null,
    environmentMap: {},
    status: "active",
    ...overrides,
  };
}

describe("provider-urls", () => {
  it("builds Render dashboard and log URLs from the service id", () => {
    const renderTarget = target({ provider: "render" });
    expect(providerDashboardUrl(renderTarget)).toBe(
      "https://dashboard.render.com/web/srv-1",
    );
    expect(providerConsoleUrl(renderTarget)).toBe(
      "https://dashboard.render.com/web/srv-1/logs",
    );
  });

  it("builds team-scoped Vercel URLs when a team slug is present", () => {
    const vercelTarget = target({
      provider: "vercel",
      slot: "frontend",
      providerProjectId: "prj_1",
      providerProjectName: "orders-web",
      providerMetadata: { vercelTeamSlug: "flowci-team" },
    });
    expect(providerDashboardUrl(vercelTarget)).toBe(
      "https://vercel.com/flowci-team/orders-web",
    );
    expect(providerConsoleUrl(vercelTarget)).toBe(
      "https://vercel.com/flowci-team/orders-web/deployments",
    );
  });

  it("falls back to project-id Vercel URLs without a team slug", () => {
    const vercelTarget = target({
      provider: "vercel",
      providerProjectId: "prj_1",
      providerMetadata: {},
    });
    expect(providerDashboardUrl(vercelTarget)).toBe(
      "https://vercel.com/dashboard/project/prj_1",
    );
    expect(providerConsoleUrl(vercelTarget)).toBe(
      "https://vercel.com/dashboard/project/prj_1/deployments",
    );
  });

  it("returns null for unknown providers", () => {
    const unknownTarget = target({
      provider: "unknown" as DeploymentTarget["provider"],
    });
    expect(providerDashboardUrl(unknownTarget)).toBeNull();
    expect(providerConsoleUrl(unknownTarget)).toBeNull();
  });

  it("maps providers to display names", () => {
    expect(providerDisplayName("render")).toBe("Render");
    expect(providerDisplayName("vercel")).toBe("Vercel");
  });
});
