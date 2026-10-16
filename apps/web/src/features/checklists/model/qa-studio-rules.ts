/* Pure QA Studio rules: which environment can be tested, the devices and the
 * hardware frames drawn around them, the resolutions a device can be viewed at,
 * the scale a device is drawn at, how the studio shares its width, and what the
 * floating checklist's launcher says. No React, no fetch. */

import type {
  ProjectBranchPreview,
  ProjectPreviewsResponse,
} from "@/shared/api/contracts";
import { QA_BRANCH } from "@/shared/api/pipeline-branches";

import { normalizeRunAutomation } from "./qa-automation-rules";
import { passedLabel } from "./qa-run-rules";
import type { QaRun } from "./qa-run-types";

/* ── Environments ────────────────────────────────────────────────────────── */

/**
 * QA Studio tests one environment: the hosted QA branch. It mirrors the
 * backend's `QA_BRANCH` (kernel/config/pipeline-branches.ts), which refuses a
 * QA run on any other branch, so the studio never offers one.
 */
export { QA_BRANCH };

export interface StudioEnvironment {
  /** Stable across reloads: one branch can be deployed by two targets. */
  key: string;
  branch: string;
  label: string;
  preview: ProjectBranchPreview;
}

/**
 * A page a tester can look at. Backend targets whose card shows logs are left
 * out: there is no page to click through. A backend older than the `surface`
 * field sends none, and that has always meant a page.
 */
function isPageEnvironment(preview: ProjectBranchPreview): boolean {
  return preview.surface === undefined || preview.surface === "page";
}

function isQaEnvironment(preview: ProjectBranchPreview): boolean {
  return preview.branch === QA_BRANCH && isPageEnvironment(preview);
}

function environmentKey(preview: ProjectBranchPreview): string {
  return `${preview.targetId}:${preview.branch}`;
}

/**
 * The QA branch's page deployments, in the order received. Every other hosted
 * branch — main included — is left out: QA runs are only accepted on the QA
 * branch. Two targets deploying it are told apart by name.
 */
export function studioEnvironments(
  previews: Pick<ProjectPreviewsResponse, "branches"> | null,
): StudioEnvironment[] {
  const pages = (previews?.branches ?? []).filter(isQaEnvironment);
  const labelled = pages.length > 1;
  return pages.map((preview) => ({
    key: environmentKey(preview),
    branch: preview.branch,
    label: labelled ? `${preview.branch} · ${preview.targetName}` : preview.branch,
    preview,
  }));
}

/** The first QA deployment, or null when the QA branch is not deployed. */
export function defaultEnvironmentKey(
  environments: ReadonlyArray<StudioEnvironment>,
): string | null {
  return environments[0]?.key ?? null;
}

/** The chosen environment, or the default when the choice is gone. */
export function resolveEnvironment(
  environments: ReadonlyArray<StudioEnvironment>,
  selectedKey: string | null,
): StudioEnvironment | null {
  const chosen = environments.find((env) => env.key === selectedKey);
  if (chosen) return chosen;
  const fallback = defaultEnvironmentKey(environments);
  return environments.find((env) => env.key === fallback) ?? null;
}

/** What the studio says when the QA branch has no page deployment. */
export const NO_QA_ENVIRONMENT = {
  title: `No ${QA_BRANCH} deployment yet`,
  text: `QA Studio tests the ${QA_BRANCH} environment — the branch QA signs off before it is promoted to main. Once ${QA_BRANCH} has a frontend deployment, it opens here.`,
  runText: `QA runs are recorded against ${QA_BRANCH}. Once it is deployed, its run appears here.`,
} as const;

/* ── Devices ─────────────────────────────────────────────────────────────── */

export type DevicePresetId = "desktop" | "tablet" | "mobile";

/** The hardware drawn around the screen. */
export type DeviceFrame = "browser" | "tablet" | "phone";

export type DeviceOrientation = "portrait" | "landscape";

export interface DevicePreset {
  id: DevicePresetId;
  label: string;
  /** CSS pixels, as the page under test sees them (portrait for rotatable devices). */
  width: number;
  height: number;
  frame: DeviceFrame;
  rotatable: boolean;
}

export const DEVICE_PRESETS: ReadonlyArray<DevicePreset> = [
  { id: "desktop", label: "Desktop", width: 1440, height: 900, frame: "browser", rotatable: false },
  { id: "tablet", label: "Tablet", width: 768, height: 1024, frame: "tablet", rotatable: true },
  { id: "mobile", label: "Mobile", width: 375, height: 812, frame: "phone", rotatable: true },
];

export function devicePreset(id: DevicePresetId): DevicePreset {
  return DEVICE_PRESETS.find((preset) => preset.id === id) ?? DEVICE_PRESETS[0];
}

/** "1440 × 900". */
export function dimensionsLabel(size: Readonly<{ width: number; height: number }>): string {
  return `${size.width} × ${size.height}`;
}

/* ── Resolutions ─────────────────────────────────────────────────────────── */

/**
 * One size a device class can be viewed at. Rotatable classes list PORTRAIT
 * sizes; landscape swaps them (see resolveDeviceDimensions).
 */
export interface ResolutionPreset {
  /** Stable and storable: "1920x1080". */
  id: string;
  width: number;
  height: number;
  /** The hardware this size stands for ("iPhone 14"), when it stands for one. */
  name: string | null;
}

function resolutionPreset(width: number, height: number, name: string | null = null): ResolutionPreset {
  return { id: `${width}x${height}`, width, height, name };
}

export const RESOLUTION_PRESETS: Readonly<Record<DevicePresetId, ReadonlyArray<ResolutionPreset>>> = {
  desktop: [
    resolutionPreset(1280, 720),
    resolutionPreset(1366, 768),
    resolutionPreset(1440, 900),
    resolutionPreset(1536, 864),
    resolutionPreset(1920, 1080),
    resolutionPreset(2560, 1440),
  ],
  tablet: [
    resolutionPreset(768, 1024, "iPad"),
    resolutionPreset(820, 1180, "iPad Air"),
    resolutionPreset(834, 1194, 'iPad Pro 11"'),
    resolutionPreset(1024, 1366, 'iPad Pro 12.9"'),
  ],
  mobile: [
    resolutionPreset(360, 800, "Android"),
    resolutionPreset(375, 667, "iPhone SE"),
    resolutionPreset(375, 812, "iPhone X/11 Pro"),
    resolutionPreset(390, 844, "iPhone 14"),
    resolutionPreset(393, 852, "iPhone 15"),
    resolutionPreset(412, 915, "Pixel"),
    resolutionPreset(430, 932, "iPhone Pro Max"),
  ],
};

/** The select's value for "Custom…": not a size, so it can never collide with a preset id. */
export const CUSTOM_RESOLUTION_OPTION = "custom";

/** What a typed size may be, in CSS pixels: a viewport outside this is not a real screen. */
export const CUSTOM_RESOLUTION_LIMITS = { minWidth: 320, maxWidth: 3840, minHeight: 320, maxHeight: 2400 } as const;

/** The size a class opens at: its device preset's own. */
export function defaultResolutionId(deviceId: DevicePresetId): string {
  const preset = devicePreset(deviceId);
  return resolutionPreset(preset.width, preset.height).id;
}

/** A class's size, as chosen: a preset, or a typed size (`choice` is what gets remembered). */
export interface Resolution {
  /** A preset id, or "custom:1500x900". */
  choice: string;
  width: number;
  height: number;
  /** Null for a typed size. */
  preset: ResolutionPreset | null;
}

const CUSTOM_CHOICE = /^custom:(\d{1,5})x(\d{1,5})$/;

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

function isValidCustomSize(width: number, height: number): boolean {
  const limits = CUSTOM_RESOLUTION_LIMITS;
  return inRange(width, limits.minWidth, limits.maxWidth) && inRange(height, limits.minHeight, limits.maxHeight);
}

/** The storable choice for a typed size. Not validated here: resolveResolution falls back from a bad one. */
export function customResolutionChoice(width: number, height: number): string {
  return `custom:${width}x${height}`;
}

function parseCustomChoice(stored: string | null): Resolution | null {
  const match = CUSTOM_CHOICE.exec(stored ?? "");
  if (!match) return null;
  const [width, height] = [Number(match[1]), Number(match[2])];
  if (!isValidCustomSize(width, height)) return null;
  return { choice: customResolutionChoice(width, height), width, height, preset: null };
}

/**
 * A class's size from what storage (or the picker) holds. Anything this build
 * does not know — nothing stored, a preset since dropped, a hand-edited or
 * out-of-range custom size, a size stored for another class — is the class's
 * default, so a stale preference can never leave the frame without a size.
 */
export function resolveResolution(deviceId: DevicePresetId, stored: string | null): Resolution {
  const presets = RESOLUTION_PRESETS[deviceId];
  const known = presets.find((preset) => preset.id === stored);
  const custom = known ? null : parseCustomChoice(stored);
  if (custom) return custom;
  const preset = known ?? presets.find((entry) => entry.id === defaultResolutionId(deviceId)) ?? presets[0];
  return { choice: preset.id, width: preset.width, height: preset.height, preset };
}

/** The option's text: "1920 × 1080", or "390 × 844 · iPhone 14". */
export function resolutionLabel(preset: ResolutionPreset): string {
  return preset.name ? `${dimensionsLabel(preset)} · ${preset.name}` : dimensionsLabel(preset);
}

export type CustomResolutionResult =
  | { ok: true; width: number; height: number }
  | { ok: false; error: string };

function wholeNumber(raw: string): number | null {
  const text = raw.trim();
  return /^\d{1,5}$/.test(text) ? Number(text) : null;
}

/** The typed width and height, as numbers within the limits, or what to tell the tester. */
export function validateCustomResolution(widthRaw: string, heightRaw: string): CustomResolutionResult {
  const limits = CUSTOM_RESOLUTION_LIMITS;
  const width = wholeNumber(widthRaw);
  const height = wholeNumber(heightRaw);
  if (width === null || !inRange(width, limits.minWidth, limits.maxWidth)) {
    return { ok: false, error: `Width must be a whole number from ${limits.minWidth} to ${limits.maxWidth}.` };
  }
  if (height === null || !inRange(height, limits.minHeight, limits.maxHeight)) {
    return { ok: false, error: `Height must be a whole number from ${limits.minHeight} to ${limits.maxHeight}.` };
  }
  return { ok: true, width, height };
}

export interface DeviceDimensions {
  width: number;
  height: number;
  /** What the viewport actually is: Desktop is always landscape. */
  orientation: DeviceOrientation;
}

/**
 * The viewport the page lays out at: the chosen `size` (the preset's own by
 * default). Landscape swaps a rotatable device's sides; a device that cannot
 * rotate keeps its size whatever was asked.
 */
export function resolveDeviceDimensions(
  preset: DevicePreset,
  orientation: DeviceOrientation,
  size: Readonly<{ width: number; height: number }> = preset,
): DeviceDimensions {
  const swap = preset.rotatable && orientation === "landscape";
  const width = swap ? size.height : size.width;
  const height = swap ? size.width : size.height;
  return { width, height, orientation: width > height ? "landscape" : "portrait" };
}

export function orientationLabel(orientation: DeviceOrientation): string {
  return orientation === "landscape" ? "Landscape" : "Portrait";
}

/**
 * The chrome around the screen, in on-screen pixels: a tablet's bezel, a
 * phone's chassis. Desktop has none: the page under test is drawn edge to edge,
 * not inside a mock browser window. The screen sits inside these insets and
 * nothing is ever drawn over it, so a site's fixed header is never covered.
 * `outsetX`/`outsetY` are hardware drawn past the frame's edge (a phone's side
 * buttons). The chrome does not scale with the device: it stays legible, and
 * only the screen shrinks to fit.
 */
export interface FrameChrome {
  top: number;
  right: number;
  bottom: number;
  left: number;
  outsetX: number;
  outsetY: number;
}

const BROWSER_CHROME: FrameChrome = { top: 0, right: 0, bottom: 0, left: 0, outsetX: 0, outsetY: 0 };
const TABLET_CHROME: FrameChrome = { top: 26, right: 26, bottom: 26, left: 26, outsetX: 0, outsetY: 0 };

/* A phone turned landscape is the same chassis turned a quarter: the top
 * bezel (island and speaker) goes left, the chin right, the side buttons to
 * the top and bottom edges. */
const FRAME_CHROME: Record<DeviceFrame, Record<DeviceOrientation, FrameChrome>> = {
  browser: { portrait: BROWSER_CHROME, landscape: BROWSER_CHROME },
  tablet: { portrait: TABLET_CHROME, landscape: TABLET_CHROME },
  phone: {
    portrait: { top: 44, right: 12, bottom: 28, left: 12, outsetX: 3, outsetY: 0 },
    landscape: { top: 12, right: 28, bottom: 12, left: 44, outsetX: 0, outsetY: 3 },
  },
};

export function frameChrome(frame: DeviceFrame, orientation: DeviceOrientation): FrameChrome {
  return FRAME_CHROME[frame][orientation];
}

/** The chrome's total width and height, outsets included. */
export function chromeSize(chrome: FrameChrome): { width: number; height: number } {
  return {
    width: chrome.left + chrome.right + 2 * chrome.outsetX,
    height: chrome.top + chrome.bottom + 2 * chrome.outsetY,
  };
}

/**
 * Never drawn smaller than this, however small the stage: a 0 or negative
 * scale would vanish. Low enough that the widest allowed size (3840) still
 * fits a 320px phone stage, so a big resolution scales down and never overflows.
 */
export const MIN_DEVICE_SCALE = 0.05;

/**
 * The scale that fits a device's screen, plus its unscaled chrome, into the
 * stage — by BOTH axes, so a 1440 × 900 desktop fits a short full-screen stage
 * as well as a narrow split pane. Never above 1 (a device is not drawn larger
 * than life). 1 before the stage has been measured.
 */
export function fitDeviceScale(
  deviceWidth: number,
  deviceHeight: number,
  stageWidth: number,
  stageHeight: number,
  chromeWidth: number,
  chromeHeight: number,
): number {
  if (deviceWidth <= 0 || deviceHeight <= 0 || stageWidth <= 0 || stageHeight <= 0) return 1;
  const byWidth = (stageWidth - chromeWidth) / deviceWidth;
  const byHeight = (stageHeight - chromeHeight) / deviceHeight;
  return Math.max(MIN_DEVICE_SCALE, Math.min(1, byWidth, byHeight));
}

/** "Scaled to 62%" when the device is drawn smaller than life, otherwise null. */
export function scaleLabel(scale: number): string | null {
  if (scale >= 1) return null;
  return `Scaled to ${Math.round(scale * 100)}%`;
}

/** "Tablet · 1024 × 768 · Landscape": what the page lays out at (no orientation for Desktop). */
export function viewportLabel(device: Pick<DevicePreset, "label" | "rotatable">, dimensions: DeviceDimensions): string {
  const size = `${device.label} · ${dimensionsLabel(dimensions)}`;
  return device.rotatable ? `${size} · ${orientationLabel(dimensions.orientation)}` : size;
}

/** "62%", the toolbar's short form of `scaleLabel`; null at life size. */
export function scalePercent(scale: number): string | null {
  if (scale >= 1) return null;
  return `${Math.round(scale * 100)}%`;
}

/* ── The run rail ────────────────────────────────────────────────────────── */

/**
 * The page under test gets the studio's width; the run panel (Checklist |
 * Playwright) is a rail on the studio's right edge, like the app's left rail:
 * a narrow strip that opens over the page on hover or keyboard focus, and a
 * pin that keeps it open and moves the page aside. Pinned or not is a
 * per-viewer, per-studio preference: pinning it in QA Studio is not a choice
 * for PO Studio. The rail stays mounted either way.
 */
export function studioRailPinnedKey(studio: "qa" | "po"): string {
  return `alphaci.${studio}-studio.rail-pinned`;
}

/* ── The rail's strip ─────────────────────────────────────────────────────── */

/**
 * "QA checklist · 3/5 passed", or just the title before a run exists: what
 * the closed rail says it holds. PO Studio's panel is its "Acceptance".
 */
export function launcherLabel(run: Pick<QaRun, "summary"> | null, title = "QA checklist"): string {
  return run ? `${title} · ${passedLabel(run)}` : title;
}

export type AutomationSignalTone = "running" | "failed" | "passed" | "none";

export interface AutomationSignal {
  tone: AutomationSignalTone;
  /** For screen readers: the dot is colour only. */
  label: string;
}

const SIGNAL_LABELS: Record<AutomationSignalTone, string> = {
  running: "Automated tests running",
  failed: "Automated tests failed",
  passed: "Automated tests passed",
  none: "No automated results",
};

function signalTone(statuses: ReadonlyArray<string | null>): AutomationSignalTone {
  if (statuses.includes("running")) return "running";
  if (statuses.includes("failure")) return "failed";
  if (statuses.includes("success")) return "passed";
  return "none";
}

/**
 * One dot for the run's CI stages: running wins (results are on the way),
 * then any failure, then a pass. Cancelled or absent stages say nothing.
 */
export function automationSignal(run: { automation?: unknown } | null): AutomationSignal {
  const automation = normalizeRunAutomation(run?.automation);
  const tone = signalTone([automation.verify?.status ?? null, automation.quality?.status ?? null]);
  return { tone, label: SIGNAL_LABELS[tone] };
}

/* ── Address ─────────────────────────────────────────────────────────────── */

function originOf(url: string, base?: string): URL | null {
  try {
    return new URL(url, base);
  } catch {
    return null;
  }
}

/** The preview's origin with the path appended. Null for an unusable address. */
export function previewPageUrl(previewUrl: string, path: string): string | null {
  const base = originOf(previewUrl);
  if (!base) return null;
  return new URL(path || "/", base.origin).toString();
}
