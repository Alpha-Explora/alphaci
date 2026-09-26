/* Pure QA Studio rules: which environment can be tested, the devices and the
 * hardware frames drawn around them, the scale a device is drawn at, the route
 * field, and what the floating checklist's launcher says. No React, no fetch. */

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

/** "768 × 1024", the preset's own size, for the device switch's tooltip. */
export function devicePresetDetail(preset: DevicePreset): string {
  return dimensionsLabel(preset);
}

export interface DeviceDimensions {
  width: number;
  height: number;
  /** What the viewport actually is: Desktop is always landscape. */
  orientation: DeviceOrientation;
}

/**
 * The viewport the page lays out at. Landscape swaps a rotatable device's
 * sides; a device that cannot rotate keeps its size whatever was asked.
 */
export function resolveDeviceDimensions(
  preset: DevicePreset,
  orientation: DeviceOrientation,
): DeviceDimensions {
  const swap = preset.rotatable && orientation === "landscape";
  const width = swap ? preset.height : preset.width;
  const height = swap ? preset.width : preset.height;
  return { width, height, orientation: width > height ? "landscape" : "portrait" };
}

export function orientationLabel(orientation: DeviceOrientation): string {
  return orientation === "landscape" ? "Landscape" : "Portrait";
}

/**
 * The chrome around the screen, in on-screen pixels: the browser's top bar,
 * a tablet's bezel, a phone's chassis. The screen sits inside these insets and
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

const BROWSER_CHROME: FrameChrome = { top: 40, right: 0, bottom: 0, left: 0, outsetX: 0, outsetY: 0 };
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

/** Never drawn smaller than this, however small the stage: a 0 or negative scale would vanish. */
export const MIN_DEVICE_SCALE = 0.1;

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

/* ── Floating checklist launcher ─────────────────────────────────────────── */

/** "QA checklist · 3/5 passed", or just "QA checklist" before a run exists. */
export function launcherLabel(run: Pick<QaRun, "summary"> | null): string {
  return run ? `QA checklist · ${passedLabel(run)}` : "QA checklist";
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
export function automationSignal(run: Pick<QaRun, "automation"> | null): AutomationSignal {
  const automation = normalizeRunAutomation(run?.automation);
  const tone = signalTone([automation.verify?.status ?? null, automation.quality?.status ?? null]);
  return { tone, label: SIGNAL_LABELS[tone] };
}

/* ── Route field ─────────────────────────────────────────────────────────── */

export type PathResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function originOf(url: string, base?: string): URL | null {
  try {
    return new URL(url, base);
  } catch {
    return null;
  }
}

function hostMismatch(host: string): PathResult {
  return {
    ok: false,
    error: `Stay on ${host}. Enter a path such as /checkout — other sites cannot be tested here.`,
  };
}

/**
 * The route field to a path on the preview's own host.
 *
 * Anything that would leave the host is refused rather than quietly
 * rewritten: another scheme, a protocol-relative `//host`, a backslash (which
 * browsers read as a slash), or a full URL to a different host. A full URL to
 * the SAME host is accepted and reduced to its path. The final check resolves
 * the path against the preview and compares origins, so no spelling of
 * "somewhere else" can get past it.
 */
export function sanitizePreviewPath(input: string, previewUrl: string): PathResult {
  const base = originOf(previewUrl);
  if (!base) return { ok: false, error: "This environment has no address to test." };
  const raw = input.trim();
  if (!raw) return { ok: true, path: "/" };
  if (raw.includes("\\")) return hostMismatch(base.host);
  const absolute = SCHEME.test(raw) || raw.startsWith("//");
  const relative = absolute || raw.startsWith("/") ? raw : `/${raw}`;
  const resolved = originOf(relative, base.origin);
  if (resolved?.origin !== base.origin) return hostMismatch(base.host);
  return { ok: true, path: `${resolved.pathname}${resolved.search}${resolved.hash}` };
}

/** "shop.example.com/checkout?step=2" for the browser frame's address pill. */
export function addressLabel(pageUrl: string): string {
  const url = originOf(pageUrl);
  if (!url) return pageUrl;
  const path = url.pathname === "/" ? "" : url.pathname;
  return `${url.host}${path}${url.search}`;
}

/** The preview's origin with the path appended. Null for an unusable address. */
export function previewPageUrl(previewUrl: string, path: string): string | null {
  const base = originOf(previewUrl);
  if (!base) return null;
  return new URL(path || "/", base.origin).toString();
}
