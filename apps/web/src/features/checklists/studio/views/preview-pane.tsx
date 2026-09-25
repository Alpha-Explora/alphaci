"use client";

import { useState, type CSSProperties } from "react";

import {
  devicePresetDetail,
  fitScale,
  scaleLabel,
  type DevicePreset,
} from "../../model/qa-studio-rules";
import { usePaneSize } from "../view-models/use-pane-size";
import type { StudioViewportViewModel } from "../view-models/use-studio-viewport-view-model";
import { ExternalIcon } from "./studio-icons";

/**
 * The live page at the chosen device width.
 *
 * A device wider than the pane is drawn smaller rather than cropped: the page
 * still lays out at the device's real width, and the frame is scaled to fit —
 * the same approach as the Overview thumbnail — with the scale printed so a
 * tester knows 62% is not how it ships. The sandbox is decided by the ViewModel
 * from the shared framing rule; the frame is interactive, because this is where
 * the testing happens.
 */
function DeviceFrame({
  url,
  frameKey,
  sandbox,
  host,
  device,
}: Readonly<{
  url: string;
  frameKey: string;
  sandbox: string;
  host: string | null;
  device: DevicePreset;
}>) {
  const { ref: paneRef, width: paneWidth, height: paneHeight } = usePaneSize<HTMLDivElement>();
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const scale = fitScale(device.width, paneWidth);
  const label = scaleLabel(scale);
  const style = {
    "--qa-device-width": device.width === null ? "100%" : `${device.width}px`,
    "--qa-scale": scale,
    // The page lays out at the device's height too: the pane's, un-scaled.
    "--qa-device-height": paneHeight > 0 ? `${paneHeight / scale}px` : "100%",
  } as CSSProperties;

  return (
    <>
      <div className="qa-preview__caption">
        <span>
          {device.label} · {devicePresetDetail(device)}
        </span>
        {label ? <span className="qa-preview__scale">{label}</span> : null}
      </div>
      <div className="qa-stage" data-device={device.id} ref={paneRef}>
        <div className="qa-device" style={style}>
          {loadedKey === frameKey ? null : (
            <p className="qa-device__loading" role="status">
              Loading preview…
            </p>
          )}
          <iframe
            key={frameKey}
            className="qa-device__frame"
            onLoad={() => setLoadedKey(frameKey)}
            referrerPolicy="no-referrer"
            sandbox={sandbox}
            src={url}
            title={`Preview of ${host ?? url}`}
          />
        </div>
      </div>
    </>
  );
}

function Unavailable({ vm }: Readonly<{ vm: StudioViewportViewModel }>) {
  return (
    <div className="qa-stage qa-stage--empty">
      <p className="qa-stage__reason">{vm.unavailableReason}</p>
      {vm.pageUrl ? (
        <a
          className="ghost-button qa-stage__open"
          href={vm.pageUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Open in new tab
          <ExternalIcon />
        </a>
      ) : null}
    </div>
  );
}

function PaneContent({ vm }: Readonly<{ vm: StudioViewportViewModel }>) {
  if (!vm.canFrame || !vm.pageUrl) return <Unavailable vm={vm} />;
  // Framable, but the dashboard origin is not known yet (server render).
  if (!vm.sandbox) {
    return (
      <div className="qa-stage">
        <p className="qa-device__loading" role="status">
          Loading preview…
        </p>
      </div>
    );
  }
  return (
    <DeviceFrame
      url={vm.pageUrl}
      frameKey={vm.frameKey}
      sandbox={vm.sandbox}
      host={vm.host}
      device={vm.device}
    />
  );
}

export function PreviewPane({ vm }: Readonly<{ vm: StudioViewportViewModel }>) {
  return (
    <section className="qa-preview" aria-label="Preview">
      <PaneContent vm={vm} />
    </section>
  );
}
