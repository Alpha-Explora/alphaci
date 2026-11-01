import type { DeploymentTarget } from "../../src/shared/api/contracts";
import {
  providerDisplayName,
  providerPublicUrl,
} from "../../src/features/projects/detail/model/provider-urls";

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
  it("maps providers to display names", () => {
    expect(providerDisplayName("render")).toBe("Render");
    expect(providerDisplayName("vercel")).toBe("Vercel");
  });

  describe("providerPublicUrl", () => {
    it("prefers the BE-computed publicUrl and trims it", () => {
      const withUrl = target({ publicUrl: "  https://orders.example.com  " });
      expect(providerPublicUrl(withUrl)).toBe("https://orders.example.com");
    });

    it("ignores a whitespace-only publicUrl and falls back to convention", () => {
      const blankUrl = target({
        provider: "render",
        publicUrl: "   ",
        providerProjectName: "orders-api",
      });
      expect(providerPublicUrl(blankUrl)).toBe(
        "https://orders-api.onrender.com",
      );
    });

    it("uses the Render metadata service URL when present", () => {
      const renderTarget = target({
        provider: "render",
        publicUrl: null,
        providerMetadata: { renderServiceUrl: "  https://svc.onrender.com  " },
      });
      expect(providerPublicUrl(renderTarget)).toBe("https://svc.onrender.com");
    });

    it("derives the Render URL from the project name without metadata", () => {
      const renderTarget = target({
        provider: "render",
        publicUrl: null,
        providerProjectName: "orders-api",
        providerMetadata: {},
      });
      expect(providerPublicUrl(renderTarget)).toBe(
        "https://orders-api.onrender.com",
      );
    });

    it("returns null for a Render target with no name to derive from", () => {
      const renderTarget = target({
        provider: "render",
        publicUrl: null,
        providerProjectName: "",
        providerMetadata: {},
      });
      expect(providerPublicUrl(renderTarget)).toBeNull();
    });

    it("derives the Vercel URL from the project name", () => {
      const vercelTarget = target({
        provider: "vercel",
        slot: "frontend",
        publicUrl: null,
        providerProjectName: "orders-web",
      });
      expect(providerPublicUrl(vercelTarget)).toBe(
        "https://orders-web.vercel.app",
      );
    });

    it("returns null for a Vercel target with no name to derive from", () => {
      const vercelTarget = target({
        provider: "vercel",
        publicUrl: null,
        providerProjectName: "",
      });
      expect(providerPublicUrl(vercelTarget)).toBeNull();
    });

    it("returns null for unknown providers", () => {
      const unknownTarget = target({
        provider: "unknown" as DeploymentTarget["provider"],
        publicUrl: null,
      });
      expect(providerPublicUrl(unknownTarget)).toBeNull();
    });
  });
});
