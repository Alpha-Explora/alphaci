/* Pure QA Studio rules: which environments can be tested, device presets, the
 * route field and the scale a device preview is drawn at. No React, no fetch. */

import type {
  ProjectBranchPreview,
  ProjectPreviewsResponse,
} from "@/shared/api/contracts";

/* ── Environments ────────────────────────────────────────────────────────── */

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

function environmentKey(preview: ProjectBranchPreview): string {
  return `${preview.targetId}:${preview.branch}`;
}

/**
 * The hosted environments in the previews response, in the order received
 * (production first). Two targets on one branch are told apart by name.
 */
export function studioEnvironments(
  previews: Pick<ProjectPreviewsResponse, "branches"> | null,
): StudioEnvironment[] {
  const pages = (previews?.branches ?? []).filter(isPageEnvironment);
  const branchCounts = new Map<string, number>();
  for (const preview of pages) {
    branchCounts.set(preview.branch, (branchCounts.get(preview.branch) ?? 0) + 1);
  }
  return pages.map((preview) => ({
    key: environmentKey(preview),
    branch: preview.branch,
    label:
      (branchCounts.get(preview.branch) ?? 0) > 1
        ? `${preview.branch} · ${preview.targetName}`
        : preview.branch,
    preview,
  }));
}

/** Production first, then a branch called main, then whatever came first. */
export function defaultEnvironmentKey(
  environments: ReadonlyArray<StudioEnvironment>,
): string | null {
  const production = environments.find((env) => env.preview.isProduction);
  const main = environments.find((env) => env.branch === "main");
  return (production ?? main ?? environments[0])?.key ?? null;
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

/* ── Devices ─────────────────────────────────────────────────────────────── */

export type DevicePresetId = "desktop" | "tablet" | "mobile";

export interface DevicePreset {
  id: DevicePresetId;
  label: string;
  /** Null fills the pane. */
  width: number | null;
}

export const DEVICE_PRESETS: ReadonlyArray<DevicePreset> = [
  { id: "desktop", label: "Desktop", width: null },
  { id: "tablet", label: "Tablet", width: 768 },
  { id: "mobile", label: "Mobile", width: 375 },
];

export function devicePreset(id: DevicePresetId): DevicePreset {
  return DEVICE_PRESETS.find((preset) => preset.id === id) ?? DEVICE_PRESETS[0];
}

/** "768px wide", or "Fills the pane" for Desktop. */
export function devicePresetDetail(preset: DevicePreset): string {
  return preset.width === null ? "Fills the pane" : `${preset.width}px wide`;
}

/**
 * The scale that fits a device into the pane. 1 when it already fits, when it
 * fills the pane anyway, or before the pane has been measured.
 */
export function fitScale(deviceWidth: number | null, paneWidth: number): number {
  if (deviceWidth === null || deviceWidth <= 0 || paneWidth <= 0) return 1;
  return Math.min(1, paneWidth / deviceWidth);
}

/** "Scaled to 62%" when the device is drawn smaller than life, otherwise null. */
export function scaleLabel(scale: number): string | null {
  if (scale >= 1) return null;
  return `Scaled to ${Math.round(scale * 100)}%`;
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

/** The preview's origin with the path appended. Null for an unusable address. */
export function previewPageUrl(previewUrl: string, path: string): string | null {
  const base = originOf(previewUrl);
  if (!base) return null;
  return new URL(path || "/", base.origin).toString();
}
