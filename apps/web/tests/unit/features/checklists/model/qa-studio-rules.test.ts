import {
  addressLabel,
  automationSignal,
  chromeSize,
  defaultEnvironmentKey,
  customResolutionChoice,
  DEVICE_PRESETS,
  defaultResolutionId,
  devicePreset,
  dimensionsLabel,
  fitDeviceScale,
  frameChrome,
  launcherLabel,
  MIN_DEVICE_SCALE,
  NO_QA_ENVIRONMENT,
  orientationLabel,
  previewPageUrl,
  QA_BRANCH,
  RESOLUTION_PRESETS,
  resolutionLabel,
  resolveDeviceDimensions,
  resolveEnvironment,
  resolveResolution,
  resolveStudioPanel,
  scaleLabel,
  studioPanelKey,
  studioEnvironments,
  validateCustomResolution,
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

describe("studio run panel", () => {
  it("is remembered per studio", () => {
    expect(studioPanelKey("qa")).toBe("alphaci.qa-studio.panel");
    expect(studioPanelKey("po")).toBe("alphaci.po-studio.panel");
  });

  it("is open unless the viewer hid it: a first visit or anything unknown shows the checklist", () => {
    expect(resolveStudioPanel("hidden")).toBe("hidden");
    expect(resolveStudioPanel("open")).toBe("open");
    expect(resolveStudioPanel(null)).toBe("open");
    expect(resolveStudioPanel("")).toBe("open");
    expect(resolveStudioPanel("split")).toBe("open");
    expect(resolveStudioPanel("HIDDEN")).toBe("open");
  });
});

describe("floating checklist launcher", () => {
  it("says how far the run is, or just the name before one exists", () => {
    const run = qaRun({ items: [runItem(0, { status: "passed" }), runItem(1), runItem(2, { status: "passed" })] });
    expect(launcherLabel(run)).toBe("QA checklist · 2/3 passed");
    expect(launcherLabel(null)).toBe("QA checklist");
  });

  it("names PO Studio's panel by its own title", () => {
    const run = qaRun({ items: [runItem(0, { status: "passed" }), runItem(1)] });
    expect(launcherLabel(run, "Acceptance")).toBe("Acceptance · 1/2 passed");
    expect(launcherLabel(null, "Acceptance")).toBe("Acceptance");
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

describe("previewPageUrl", () => {
  const base = "https://shop.example.com/some/path";

  it("appends the path to the preview's origin, dropping its own path", () => {
    expect(previewPageUrl(base, "/checkout")).toBe("https://shop.example.com/checkout");
    expect(previewPageUrl(base, "")).toBe("https://shop.example.com/");
    expect(previewPageUrl("nope", "/x")).toBeNull();
  });
});

describe("resolution presets", () => {
  const sizes = (id: "desktop" | "tablet" | "mobile") =>
    RESOLUTION_PRESETS[id].map((preset) => `${preset.width}x${preset.height}`);

  it("lists the agreed sizes per class, portrait for the rotatable ones", () => {
    expect(sizes("desktop")).toEqual(["1280x720", "1366x768", "1440x900", "1536x864", "1920x1080", "2560x1440"]);
    expect(sizes("tablet")).toEqual(["768x1024", "820x1180", "834x1194", "1024x1366"]);
    expect(sizes("mobile")).toEqual(["360x800", "375x667", "375x812", "390x844", "393x852", "412x915", "430x932"]);
    for (const id of ["tablet", "mobile"] as const) {
      expect(RESOLUTION_PRESETS[id].every((preset) => preset.height > preset.width)).toBe(true);
    }
  });

  it("names the hardware a size stands for, and labels desktop sizes bare", () => {
    expect(resolutionLabel(RESOLUTION_PRESETS.desktop[4])).toBe("1920 × 1080");
    expect(resolutionLabel(RESOLUTION_PRESETS.mobile[3])).toBe("390 × 844 · iPhone 14");
    expect(resolutionLabel(RESOLUTION_PRESETS.tablet[2])).toBe('834 × 1194 · iPad Pro 11"');
  });

  it("opens every class on its device preset's own size, which is one of its presets", () => {
    for (const preset of DEVICE_PRESETS) {
      const id = defaultResolutionId(preset.id);
      expect(id).toBe(`${preset.width}x${preset.height}`);
      expect(RESOLUTION_PRESETS[preset.id].map((entry) => entry.id)).toContain(id);
      expect(resolveResolution(preset.id, null)).toMatchObject({ choice: id, width: preset.width, height: preset.height });
    }
  });

  it("has unique ids within a class", () => {
    for (const presets of Object.values(RESOLUTION_PRESETS)) {
      expect(new Set(presets.map((preset) => preset.id)).size).toBe(presets.length);
    }
  });
});

describe("resolveResolution", () => {
  it("resolves a known preset id to its size", () => {
    expect(resolveResolution("desktop", "1920x1080")).toEqual({
      choice: "1920x1080",
      width: 1920,
      height: 1080,
      preset: RESOLUTION_PRESETS.desktop[4],
    });
    expect(resolveResolution("mobile", "390x844")).toMatchObject({ width: 390, height: 844 });
  });

  it("resolves a typed size, normalising its spelling", () => {
    expect(resolveResolution("desktop", "custom:1500x900")).toEqual({
      choice: "custom:1500x900",
      width: 1500,
      height: 900,
      preset: null,
    });
    expect(resolveResolution("desktop", "custom:01500x0900").choice).toBe("custom:1500x900");
  });

  it.each([null, "", "garbage", "1920x1081", "custom:", "custom:100x900", "custom:5000x900", "custom:1500x100", "custom:1500x2500", "custom:1500x900x1"])(
    "falls back to the class default for %p",
    (stored) => {
      expect(resolveResolution("desktop", stored)).toMatchObject({ choice: "1440x900", width: 1440, height: 900 });
    },
  );

  it("does not take another class's size", () => {
    expect(resolveResolution("mobile", "1920x1080")).toMatchObject({ choice: "375x812" });
    expect(resolveResolution("tablet", "375x812")).toMatchObject({ choice: "768x1024" });
  });

  it("builds a storable custom choice", () => {
    expect(customResolutionChoice(1500, 900)).toBe("custom:1500x900");
  });
});

describe("validateCustomResolution", () => {
  it("accepts whole numbers within 320–3840 wide and 320–2400 tall, edges included", () => {
    expect(validateCustomResolution("1500", "900")).toEqual({ ok: true, width: 1500, height: 900 });
    expect(validateCustomResolution(" 320 ", "320")).toEqual({ ok: true, width: 320, height: 320 });
    expect(validateCustomResolution("3840", "2400")).toEqual({ ok: true, width: 3840, height: 2400 });
  });

  it.each([
    ["319", "900", /Width must be a whole number from 320 to 3840/],
    ["3841", "900", /Width/],
    ["", "900", /Width/],
    ["abc", "900", /Width/],
    ["1500.5", "900", /Width/],
    ["-1500", "900", /Width/],
    ["1500", "319", /Height must be a whole number from 320 to 2400/],
    ["1500", "2401", /Height/],
    ["1500", "", /Height/],
  ])("refuses %p × %p", (width, height, message) => {
    const result = validateCustomResolution(width, height);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });

  it("names the width first when both are wrong", () => {
    const result = validateCustomResolution("10", "10");
    expect(result.ok === false && result.error).toMatch(/Width/);
  });
});

describe("resolveDeviceDimensions with a chosen size", () => {
  it("uses the chosen size instead of the preset's", () => {
    const desktop = devicePreset("desktop");
    expect(resolveDeviceDimensions(desktop, "portrait", { width: 1920, height: 1080 })).toEqual({
      width: 1920,
      height: 1080,
      orientation: "landscape",
    });
  });

  it("swaps the chosen size in landscape for a rotatable class, and never for Desktop", () => {
    const iphone = { width: 390, height: 844 };
    expect(resolveDeviceDimensions(devicePreset("mobile"), "portrait", iphone)).toEqual({ width: 390, height: 844, orientation: "portrait" });
    expect(resolveDeviceDimensions(devicePreset("mobile"), "landscape", iphone)).toEqual({ width: 844, height: 390, orientation: "landscape" });
    expect(resolveDeviceDimensions(devicePreset("tablet"), "landscape", { width: 1024, height: 1366 })).toEqual({
      width: 1366,
      height: 1024,
      orientation: "landscape",
    });
    expect(resolveDeviceDimensions(devicePreset("desktop"), "landscape", { width: 1920, height: 1080 })).toMatchObject({ width: 1920, height: 1080 });
  });
});

describe("fitDeviceScale for large resolutions", () => {
  it("scales 2560 × 1440 down to fit a docked stage and never overflows it", () => {
    const scale = fitDeviceScale(2560, 1440, 734, 700, 0, 40);
    expect(scale).toBeCloseTo(734 / 2560, 6);
    expect(2560 * scale).toBeLessThanOrEqual(734);
    expect(1440 * scale + 40).toBeLessThanOrEqual(700);
  });

  it("still fits the widest allowed size into a phone-width stage", () => {
    const scale = fitDeviceScale(3840, 2400, 320, 600, 0, 40);
    expect(scale).toBeGreaterThan(MIN_DEVICE_SCALE);
    expect(3840 * scale).toBeLessThanOrEqual(320);
    expect(fitDeviceScale(3840, 2400, 300, 600, 0, 40) * 3840).toBeLessThanOrEqual(300);
  });
});
