"use client";

import { useState } from "react";

import {
  canFramePreview,
  displayHost,
  previewFrameSandbox,
  previewUnavailableReason,
  type ProjectBranchPreview,
} from "@/features/projects";
import { useBranchPreviewsViewModel, useDashboardOrigin } from "@/features/projects/previews";

import {
  devicePreset,
  previewPageUrl,
  resolveEnvironment,
  sanitizePreviewPath,
  studioEnvironments,
  type DevicePreset,
  type DevicePresetId,
  type StudioEnvironment,
} from "../../model/qa-studio-rules";

export interface StudioViewportViewModel {
  /** The previews request: loading until the environments are known. */
  status: "loading" | "ready" | "error";
  error: string | null;
  /** Set when a host could not be reached, so an empty list is not read as "nothing deployed". */
  providerError: string | null;
  environments: StudioEnvironment[];
  environment: StudioEnvironment | null;
  selectEnvironment: (key: string) => void;
  device: DevicePreset;
  setDevice: (id: DevicePresetId) => void;
  pathDraft: string;
  setPathDraft: (value: string) => void;
  pathError: string | null;
  /** Validate the route field and navigate the frame to it. */
  submitPath: () => void;
  /** The page the frame shows and "Open in new tab" opens. */
  pageUrl: string | null;
  /** The environment's host, shown before the route field. */
  host: string | null;
  /**
   * The frame's sandbox, from the same rule as every other framed preview.
   * Null until the dashboard origin is known: a sandbox is fixed when the
   * frame first navigates, so the frame must not mount before it.
   */
  sandbox: string | null;
  /** True only for a confirmed-embeddable, live deployment. */
  canFrame: boolean;
  /** Why the page is not framed, when it is not. */
  unavailableReason: string | null;
  /** Changes whenever the frame must re-mount: a reload, a new route, a new environment. */
  frameKey: string;
  reload: () => void;
  retry: () => void;
}

interface FrameState {
  pageUrl: string | null;
  host: string | null;
  sandbox: string | null;
  canFrame: boolean;
  unavailableReason: string | null;
}

const NO_FRAME: FrameState = {
  pageUrl: null,
  host: null,
  sandbox: null,
  canFrame: false,
  unavailableReason: null,
};

/** Everything the frame needs, from the chosen preview and the committed route. */
function frameState(
  preview: ProjectBranchPreview | null,
  path: string,
  origin: string | null,
): FrameState {
  if (!preview) return NO_FRAME;
  const pageUrl = preview.previewUrl ? previewPageUrl(preview.previewUrl, path) : null;
  const canFrame = pageUrl !== null && canFramePreview(preview);
  return {
    pageUrl,
    host: preview.previewUrl ? displayHost(preview.previewUrl) : null,
    sandbox: origin && pageUrl ? previewFrameSandbox(pageUrl, origin) : null,
    canFrame,
    unavailableReason: canFrame ? null : previewUnavailableReason(preview),
  };
}

/**
 * ViewModel for the studio's left pane and toolbar: which environment is
 * under test, at what device width, on which route.
 *
 * The previews come from the same ViewModel the Overview's deployment cards
 * use, so the studio sees exactly the environments and embeddability verdicts
 * the rest of the page does.
 */
export function useStudioViewportViewModel(options: {
  projectId: string;
  enabled: boolean;
}): StudioViewportViewModel {
  const previews = useBranchPreviewsViewModel(options);
  const origin = useDashboardOrigin();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<DevicePresetId>("desktop");
  const [path, setPath] = useState("/");
  const [pathDraft, setPathDraft] = useState("/");
  const [pathError, setPathError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const environments = studioEnvironments(previews.previews);
  const environment = resolveEnvironment(environments, selectedKey);
  const preview = environment?.preview ?? null;
  const frame = frameState(preview, path, origin);

  function selectEnvironment(key: string) {
    // A route on one environment means nothing on another: start at its root.
    setSelectedKey(key);
    setPath("/");
    setPathDraft("/");
    setPathError(null);
  }

  function updatePathDraft(value: string) {
    setPathDraft(value);
    setPathError(null);
  }

  function submitPath() {
    if (!preview?.previewUrl) return;
    const result = sanitizePreviewPath(pathDraft, preview.previewUrl);
    if (!result.ok) {
      setPathError(result.error);
      return;
    }
    setPath(result.path);
    setPathDraft(result.path);
    setPathError(null);
    // Enter on the same route navigates again, like a browser's address bar.
    setNonce((value) => value + 1);
  }

  return {
    status: previews.status,
    error: previews.error,
    providerError: previews.previews?.providerError ?? null,
    environments,
    environment,
    selectEnvironment,
    device: devicePreset(deviceId),
    setDevice: setDeviceId,
    pathDraft,
    setPathDraft: updatePathDraft,
    pathError,
    submitPath,
    ...frame,
    frameKey: `${environment?.key ?? "none"}|${frame.pageUrl ?? ""}|${String(nonce)}`,
    reload: () => setNonce((value) => value + 1),
    retry: previews.reload,
  };
}
