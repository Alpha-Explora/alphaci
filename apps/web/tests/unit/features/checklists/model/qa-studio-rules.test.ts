import {
  addressLabel,
  automationSignal,
  chromeSize,
  DEFAULT_STUDIO_LAYOUT,
  defaultEnvironmentKey,
  DEVICE_PRESETS,
  devicePreset,
  devicePresetDetail,
  dimensionsLabel,
  fitDeviceScale,
  frameChrome,
  isStudioLayout,
  launcherLabel,
  MIN_DEVICE_SCALE,
  NO_QA_ENVIRONMENT,
  orientationLabel,
  previewPageUrl,
  QA_BRANCH,
  resolveDeviceDimensions,
  resolveEnvironment,
  resolveStudioLayout,
  sanitizePreviewPath,
  scaleLabel,
  STUDIO_LAYOUTS,
  studioEnvironments,
} from "../../../../../src/features/checklists/model/qa-studio-rules";
import type { ProjectBranchPreview } from "../../../../../src/shared/api/contracts";
import { automation, qualitySuccess, verifyFailure } from "../qa-automation-fixtures";
import { qaRun, runItem } from "../qa-run-fixtures";

function preview(overrides: Partial<ProjectBranchPreview> = {}): ProjectBranchPreview {
  return {
    branch: "uat",
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

describe("studioEnvironments (QA branch only)", () => {
  it("mirrors the backend's QA branch", () => {
    expect(QA_BRANCH).toBe("uat");
  });

  it("offers only the uat page deployments — never main, production or another branch", () => {
    const envs = studioEnvironments({
      branches: [
        preview({ branch: "main", isProduction: true, surface: "page" }),
        preview({ branch: "uat" }),
        preview({ branch: "dev", targetId: "web" }),
        preview({ branch: "feature/x" }),
        preview({ branch: "uat", targetId: "api", surface: "logs" }),
      ],
    });
    expect(envs.map((env) => env.key)).toEqual(["web:uat"]);
    expect(envs.map((env) => env.label)).toEqual(["uat"]);
    expect(studioEnvironments(null)).toEqual([]);
  });

  it("is empty when uat is not deployed, even though main is", () => {
    const envs = studioEnvironments({ branches: [preview({ branch: "main", isProduction: true })] });
    expect(envs).toEqual([]);
    expect(defaultEnvironmentKey(envs)).toBeNull();
    expect(resolveEnvironment(envs, "web:main")).toBeNull();
  });

  it("tells two targets deploying uat apart by name", () => {
    const envs = studioEnvironments({
      branches: [preview(), preview({ targetId: "admin", targetName: "admin-web" })],
    });
    expect(envs.map((env) => env.label)).toEqual(["uat · storefront-web", "uat · admin-web"]);
  });

  it("defaults to the first uat deployment and falls back to it when a choice vanishes", () => {
    const envs = studioEnvironments({
      branches: [preview(), preview({ targetId: "admin", targetName: "admin-web" })],
    });
    expect(defaultEnvironmentKey(envs)).toBe("web:uat");
    expect(resolveEnvironment(envs, "admin:uat")?.key).toBe("admin:uat");
    expect(resolveEnvironment(envs, "web:main")?.key).toBe("web:uat");
  });

  it("explains the missing QA environment without naming another branch to test", () => {
    expect(NO_QA_ENVIRONMENT.title).toBe("No uat deployment yet");
    expect(NO_QA_ENVIRONMENT.text).toMatch(/^QA Studio tests the uat environment/);
  });
});

describe("devices", () => {
  it("defines true viewports: Desktop 1440 × 900 (browser), Tablet 768 × 1024 and Mobile 375 × 812", () => {
    expect(DEVICE_PRESETS.map((p) => [p.id, p.width, p.height, p.frame, p.rotatable])).toEqual([
      ["desktop", 1440, 900, "browser", false],
      ["tablet", 768, 1024, "tablet", true],
      ["mobile", 375, 812, "phone", true],
    ]);
    expect(devicePresetDetail(devicePreset("tablet"))).toBe("768 × 1024");
    expect(dimensionsLabel({ width: 1440, height: 900 })).toBe("1440 × 900");
  });

  it("swaps a rotatable device's sides in landscape and keeps Desktop as it is", () => {
    expect(resolveDeviceDimensions(devicePreset("tablet"), "portrait")).toEqual({ width: 768, height: 1024, orientation: "portrait" });
    expect(resolveDeviceDimensions(devicePreset("tablet"), "landscape")).toEqual({ width: 1024, height: 768, orientation: "landscape" });
    expect(resolveDeviceDimensions(devicePreset("mobile"), "landscape")).toEqual({ width: 812, height: 375, orientation: "landscape" });
    // Desktop cannot rotate: asking for portrait still gives the 1440 × 900 landscape viewport.
    expect(resolveDeviceDimensions(devicePreset("desktop"), "portrait")).toEqual({ width: 1440, height: 900, orientation: "landscape" });
    expect(orientationLabel("landscape")).toBe("Landscape");
  });

  it("draws the chrome outside the screen: a browser bar on top, a symmetric tablet bezel, a phone chassis that turns", () => {
    expect(frameChrome("browser", "landscape")).toMatchObject({ top: 40, right: 0, bottom: 0, left: 0 });
    expect(frameChrome("tablet", "portrait")).toEqual(frameChrome("tablet", "landscape"));
    const portrait = frameChrome("phone", "portrait");
    const landscape = frameChrome("phone", "landscape");
    // A quarter turn: the island's top bezel becomes the left, the chin the right.
    expect([landscape.left, landscape.right, landscape.top, landscape.bottom]).toEqual([
      portrait.top,
      portrait.bottom,
      portrait.left,
      portrait.right,
    ]);
    expect(chromeSize(portrait)).toEqual({ width: 12 + 12 + 6, height: 44 + 28 });
    expect(chromeSize(landscape)).toEqual({ width: 44 + 28, height: 12 + 12 + 6 });
  });
});

describe("fitDeviceScale (both axes, never above 1)", () => {
  it("is limited by width in a narrow split pane", () => {
    // 1440 × 900 + 40px bar into a 734 × 700 stage: width wins (734/1440).
    expect(fitDeviceScale(1440, 900, 734, 700, 0, 40)).toBeCloseTo(734 / 1440, 6);
  });

  it("is limited by height on a short, wide stage", () => {
    // Full screen 1414 × 760: width allows 0.98, height (760 - 40) / 900 = 0.8.
    expect(fitDeviceScale(1440, 900, 1414, 760, 0, 40)).toBeCloseTo(0.8, 6);
  });

  it("subtracts the chrome on both axes", () => {
    // Phone portrait: (400 - 30) / 375 vs (600 - 72) / 812.
    expect(fitDeviceScale(375, 812, 400, 600, 30, 72)).toBeCloseTo(528 / 812, 6);
  });

  it("never draws a device larger than life", () => {
    expect(fitDeviceScale(375, 812, 2000, 2000, 30, 72)).toBe(1);
  });

  it("is 1 before the stage is measured and never collapses to zero", () => {
    expect(fitDeviceScale(1440, 900, 0, 0, 0, 40)).toBe(1);
    expect(fitDeviceScale(0, 900, 500, 500, 0, 40)).toBe(1);
    expect(fitDeviceScale(1440, 900, 20, 20, 0, 40)).toBe(MIN_DEVICE_SCALE);
  });

  it("labels a scaled-down device and says nothing at 100%", () => {
    expect(scaleLabel(0.509)).toBe("Scaled to 51%");
    expect(scaleLabel(1)).toBeNull();
  });
});

describe("studio layout", () => {
  it("offers wide preview (the default) and split, in that order", () => {
    expect(STUDIO_LAYOUTS.map((option) => option.id)).toEqual(["wide", "split"]);
    expect(STUDIO_LAYOUTS.map((option) => option.label)).toEqual(["Wide preview", "Split"]);
    expect(DEFAULT_STUDIO_LAYOUT).toBe("wide");
  });

  it("reads back a stored layout, and falls back to wide for anything else", () => {
    expect(resolveStudioLayout("split")).toBe("split");
    expect(resolveStudioLayout("wide")).toBe("wide");
    expect(resolveStudioLayout(null)).toBe("wide");
    expect(resolveStudioLayout("")).toBe("wide");
    expect(resolveStudioLayout("full-screen")).toBe("wide");
    expect(resolveStudioLayout("SPLIT")).toBe("wide");
  });

  it("recognises only the layouts this build knows", () => {
    expect(isStudioLayout("split")).toBe(true);
    expect(isStudioLayout("stacked")).toBe(false);
    expect(isStudioLayout(undefined)).toBe(false);
  });
});

describe("floating checklist launcher", () => {
  it("says how far the run is, or just the name before one exists", () => {
    const run = qaRun({ items: [runItem(0, { status: "passed" }), runItem(1), runItem(2, { status: "passed" })] });
    expect(launcherLabel(run)).toBe("QA checklist · 2/3 passed");
    expect(launcherLabel(null)).toBe("QA checklist");
  });

  it("gives one automation dot: running wins, then a failure, then a pass", () => {
    expect(automationSignal(qaRun({ automation: automation() })).tone).toBe("failed");
    expect(
      automationSignal(qaRun({ automation: automation({ verify: verifyFailure({ status: "running" }) }) })).tone,
    ).toBe("running");
    expect(
      automationSignal(qaRun({ automation: automation({ verify: null, quality: qualitySuccess() }) })),
    ).toEqual({ tone: "passed", label: "Automated tests passed" });
    expect(automationSignal(qaRun({ automation: undefined })).tone).toBe("none");
    expect(automationSignal(null)).toEqual({ tone: "none", label: "No automated results" });
    expect(
      automationSignal(qaRun({ automation: automation({ verify: verifyFailure({ status: "cancelled" }), quality: null }) })).tone,
    ).toBe("none");
  });

  it("puts the host and path in the browser frame's address pill", () => {
    expect(addressLabel("https://shop.example.com/")).toBe("shop.example.com");
    expect(addressLabel("https://shop.example.com/checkout?step=2")).toBe("shop.example.com/checkout?step=2");
    expect(addressLabel("not a url")).toBe("not a url");
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
