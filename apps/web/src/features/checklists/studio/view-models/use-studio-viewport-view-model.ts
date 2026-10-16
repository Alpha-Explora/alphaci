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
  CUSTOM_RESOLUTION_OPTION,
  customResolutionChoice,
  previewPageUrl,
  resolveDeviceDimensions,
  resolveEnvironment,
  studioEnvironments,
  type DeviceDimensions,
  type DeviceOrientation,
  type DevicePreset,
  type DevicePresetId,
  type Resolution,
  type StudioEnvironment,
} from "../../model/qa-studio-rules";
import { useCopyLink, type CopyLinkStatus } from "./use-copy-link";
import { useStudioFullScreen, type StudioFullScreenState } from "./use-studio-full-screen";
import { useStudioPanel, type StudioPanelState } from "./use-studio-panel";
import { useStudioResolution } from "./use-studio-resolution";

export interface StudioViewportViewModel extends StudioFullScreenState, StudioPanelState {
  /** The previews request: loading until the environments are known. */
  status: "loading" | "ready" | "error";
  error: string | null;
  /** Set when a host could not be reached, so an empty list is not read as "nothing deployed". */
  providerError: string | null;
  /** Only the QA branch's page deployments: QA runs are accepted nowhere else. */
  environments: StudioEnvironment[];
  environment: StudioEnvironment | null;
  selectEnvironment: (key: string) => void;
  device: DevicePreset;
  setDevice: (id: DevicePresetId) => void;
  /** The chosen orientation; kept across devices, applied only to rotatable ones. */
  orientation: DeviceOrientation;
  /** The size the selected device class is viewed at, before orientation (portrait for rotatable classes). */
  resolution: Resolution;
  /** A preset id, or the custom option: switching to custom keeps the size in view. */
  setResolution: (value: string) => void;
  /** A typed size, already validated by the caller. */
  setCustomResolution: (width: number, height: number) => void;
  /** The viewport the page lays out at, resolution and orientation applied. */
  dimensions: DeviceDimensions;
  canRotate: boolean;
  /** Portrait ⇄ landscape. Does nothing on a device that cannot rotate. */
  rotate: () => void;
  /** The page the frame shows, "Open in new tab" opens and "Copy link" shares: the environment's root. */
  pageUrl: string | null;
  /** Puts `pageUrl` on the clipboard. Does nothing without one. */
  copyLink: () => Promise<void>;
  /** Resets to idle by itself, so a "Copied" never lingers. */
  copyLinkStatus: CopyLinkStatus;
  /** The environment's host, for the frame's title. */
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
  /**
   * Changes whenever the frame must re-mount: a reload or a new environment.
   * Never the device, resolution, orientation, the panel or full screen: those only
   * restyle the frame, so the page under test keeps its state.
   */
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

/** Everything the frame needs, from the chosen preview: it always opens the environment's root. */
function frameState(preview: ProjectBranchPreview | null, origin: string | null): FrameState {
  if (!preview) return NO_FRAME;
  const pageUrl = preview.previewUrl ? previewPageUrl(preview.previewUrl, "/") : null;
  const canFrame = pageUrl !== null && canFramePreview(preview);
  return {
    pageUrl,
    host: preview.previewUrl ? displayHost(preview.previewUrl) : null,
    sandbox: origin && pageUrl ? previewFrameSandbox(pageUrl, origin) : null,
    canFrame,
    unavailableReason: canFrame ? null : previewUnavailableReason(preview),
  };
}

function frameKeyOf(environment: StudioEnvironment | null, pageUrl: string | null, nonce: number): string {
  return `${environment?.key ?? "none"}|${pageUrl ?? ""}|${String(nonce)}`;
}

/**
 * ViewModel for the studio's left pane and toolbar: which environment is
 * under test (only ever the QA branch), on which device, resolution and
 * orientation — and how the studio is laid out: the page across the whole
 * width, docked or full screen, with the run panel floating over its edge
 * (open or hidden, remembered per studio).
 *
 * The previews come from the same ViewModel the Overview's deployment cards
 * use, so the studio sees exactly the environments and embeddability verdicts
 * the rest of the page does.
 */
export function useStudioViewportViewModel(options: {
  projectId: string;
  enabled: boolean;
  /** Whose panel preference to read: QA Studio's or PO Studio's. */
  studio?: "qa" | "po";
}): StudioViewportViewModel {
  const previews = useBranchPreviewsViewModel(options);
  const origin = useDashboardOrigin();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<DevicePresetId>("desktop");
  const [orientation, setOrientation] = useState<DeviceOrientation>("portrait");
  const fullScreen = useStudioFullScreen();
  const panel = useStudioPanel(options.studio ?? "qa");
  const [nonce, setNonce] = useState(0);

  const environments = studioEnvironments(previews.previews);
  const environment = resolveEnvironment(environments, selectedKey);
  const preview = environment?.preview ?? null;
  const frame = frameState(preview, origin);
  const device = devicePreset(deviceId);
  const { resolution, chooseResolution, chooseCustomResolution } = useStudioResolution(deviceId);
  const copy = useCopyLink(frame.pageUrl);

  function setResolution(value: string) {
    // "Custom…" starts from the size in view, so choosing it never jumps the frame.
    chooseResolution(value === CUSTOM_RESOLUTION_OPTION ? customResolutionChoice(resolution.width, resolution.height) : value);
  }

  return {
    status: previews.status,
    error: previews.error,
    providerError: previews.previews?.providerError ?? null,
    environments,
    environment,
    selectEnvironment: setSelectedKey,
    device,
    setDevice: setDeviceId,
    orientation,
    resolution,
    setResolution,
    setCustomResolution: chooseCustomResolution,
    dimensions: resolveDeviceDimensions(device, orientation, resolution),
    canRotate: device.rotatable,
    rotate: () => {
      if (device.rotatable) setOrientation((value) => (value === "portrait" ? "landscape" : "portrait"));
    },
    ...frame,
    copyLink: copy.copy,
    copyLinkStatus: copy.status,
    frameKey: frameKeyOf(environment, frame.pageUrl, nonce),
    reload: () => setNonce((value) => value + 1),
    retry: previews.reload,
    ...fullScreen,
    ...panel,
  };
}
