import {
  defaultEnvironmentKey,
  devicePreset,
  devicePresetDetail,
  fitScale,
  previewPageUrl,
  resolveEnvironment,
  sanitizePreviewPath,
  scaleLabel,
  studioEnvironments,
} from "../../../../../src/features/checklists/model/qa-studio-rules";
import type { ProjectBranchPreview } from "../../../../../src/shared/api/contracts";

function preview(overrides: Partial<ProjectBranchPreview> = {}): ProjectBranchPreview {
  return {
    branch: "main",
    isProduction: false,
    deploymentId: "d1",
    targetId: "web",
    targetName: "storefront-web",
    provider: "vercel",
    status: "ready",
    commitSha: "abc",
    commitMessage: null,
    pullRequestNumber: null,
    previewUrl: "https://shop.example.com",
    inspectorUrl: null,
    createdAt: null,
    readyAt: null,
    embeddable: true,
    embedBlockedReason: null,
    ...overrides,
  };
}

describe("studioEnvironments", () => {
  it("keeps page environments (or ones with no surface) and drops log-only backends", () => {
    const envs = studioEnvironments({
      branches: [
        preview({ branch: "main", isProduction: true, surface: "page" }),
        preview({ branch: "uat" }),
        preview({ branch: "main", targetId: "api", surface: "logs" }),
      ],
    });
    expect(envs.map((env) => env.key)).toEqual(["web:main", "web:uat"]);
    expect(envs.map((env) => env.label)).toEqual(["main", "uat"]);
    expect(studioEnvironments(null)).toEqual([]);
  });

  it("tells two targets on one branch apart by name", () => {
    const envs = studioEnvironments({
      branches: [preview(), preview({ targetId: "admin", targetName: "admin-web" })],
    });
    expect(envs.map((env) => env.label)).toEqual(["main · storefront-web", "main · admin-web"]);
  });

  it("defaults to production, then main, then the first, and falls back when a choice vanishes", () => {
    const envs = studioEnvironments({
      branches: [preview({ branch: "feature" }), preview({ branch: "main" }), preview({ branch: "prod", isProduction: true })],
    });
    expect(defaultEnvironmentKey(envs)).toBe("web:prod");
    expect(defaultEnvironmentKey(envs.slice(0, 2))).toBe("web:main");
    expect(defaultEnvironmentKey(envs.slice(0, 1))).toBe("web:feature");
    expect(defaultEnvironmentKey([])).toBeNull();
    expect(resolveEnvironment(envs, "web:feature")?.branch).toBe("feature");
    expect(resolveEnvironment(envs, "gone")?.branch).toBe("prod");
  });
});

describe("devices and scale", () => {
  it("defines Desktop (fills), Tablet 768 and Mobile 375", () => {
    expect(devicePreset("desktop").width).toBeNull();
    expect(devicePreset("tablet").width).toBe(768);
    expect(devicePreset("mobile").width).toBe(375);
    expect(devicePresetDetail(devicePreset("tablet"))).toBe("768px wide");
    expect(devicePresetDetail(devicePreset("desktop"))).toBe("Fills the pane");
  });

  it("scales a device down to fit the pane, never up", () => {
    expect(fitScale(768, 500)).toBeCloseTo(0.651, 3);
    expect(fitScale(375, 500)).toBe(1);
    expect(fitScale(null, 500)).toBe(1);
    expect(fitScale(768, 0)).toBe(1);
    expect(scaleLabel(0.651)).toBe("Scaled to 65%");
    expect(scaleLabel(1)).toBeNull();
  });
});

describe("sanitizePreviewPath", () => {
  const base = "https://shop.example.com/some/path";

  it("keeps same-host paths, adding the leading slash", () => {
    expect(sanitizePreviewPath("/checkout?step=2#pay", base)).toEqual({ ok: true, path: "/checkout?step=2#pay" });
    expect(sanitizePreviewPath("cart", base)).toEqual({ ok: true, path: "/cart" });
    expect(sanitizePreviewPath("   ", base)).toEqual({ ok: true, path: "/" });
    expect(sanitizePreviewPath("https://shop.example.com/orders", base)).toEqual({ ok: true, path: "/orders" });
  });

  it.each([
    "https://evil.example.com/steal",
    "//evil.example.com/x",
    "javascript:alert(1)",
    "\\\\evil.example.com",
    "/\\evil.example.com",
    "http://shop.example.com/downgrade",
    "data:text/html,hi",
  ])("refuses %s", (input) => {
    const result = sanitizePreviewPath(input, base);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Stay on shop\.example\.com/);
  });

  it("refuses everything when the environment has no usable address", () => {
    expect(sanitizePreviewPath("/x", "not a url").ok).toBe(false);
  });

  it("appends the path to the preview's origin, dropping its own path", () => {
    expect(previewPageUrl(base, "/checkout")).toBe("https://shop.example.com/checkout");
    expect(previewPageUrl(base, "")).toBe("https://shop.example.com/");
    expect(previewPageUrl("nope", "/x")).toBeNull();
  });
});
