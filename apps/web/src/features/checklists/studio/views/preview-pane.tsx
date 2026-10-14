"use client";

import { useState, type CSSProperties } from "react";

import {
  addressLabel,
  chromeSize,
  dimensionsLabel,
  fitDeviceScale,
  frameChrome,
  orientationLabel,
  scaleLabel,
} from "../../model/qa-studio-rules";
import type { PreviewCaptureTarget } from "../view-models/preview-capture-target";
import { usePaneSize } from "../view-models/use-pane-size";
import type { StudioViewportViewModel } from "../view-models/use-studio-viewport-view-model";
import { ExternalIcon } from "./studio-icons";

/** The CSS custom properties one device is drawn from. */
function deviceStyle(vm: StudioViewportViewModel, stage: { width: number; height: number }) {
  const { width, height, orientation } = vm.dimensions;
  const chrome = frameChrome(vm.device.frame, orientation);
  const outer = chromeSize(chrome);
  const scale = fitDeviceScale(width, height, stage.width, stage.height, outer.width, outer.height);
  const style = {
    "--qa-screen-w": width,
    "--qa-screen-h": height,
    "--qa-scale": scale,
    "--qa-chrome-top": `${chrome.top}px`,
    "--qa-chrome-right": `${chrome.right}px`,
    "--qa-chrome-bottom": `${chrome.bottom}px`,
    "--qa-chrome-left": `${chrome.left}px`,
  } as CSSProperties;
  return { style, scale };
}

function captionText(vm: StudioViewportViewModel): string {
  const size = `${vm.device.label} · ${dimensionsLabel(vm.dimensions)}`;
  return vm.device.rotatable ? `${size} · ${orientationLabel(vm.dimensions.orientation)}` : size;
}

/**
 * The live page, drawn at the device's true viewport inside its hardware.
 *
 * ONE DOM for every device, orientation and for full screen: the chrome parts
 * (browser bar, bezel sensor, home bar, side buttons) are always rendered and
 * CSS shows the ones the frame has. Switching device or rotating changes only
 * `data-*` attributes and custom properties, so React never re-creates the
 * iframe and the site under test keeps its scroll, form input and login.
 *
 * The page lays out at the device's real size; only the screen is scaled to
 * fit the stage (by both axes), with the scale printed so a tester knows 48%
 * is not how it ships. The chrome is not scaled, so it stays legible, and it
 * sits outside the screen so it never covers a site's fixed header.
 */
function DeviceFrame({
  vm,
  url,
  sandbox,
  frameRef,
}: Readonly<{ vm: StudioViewportViewModel; url: string; sandbox: string; frameRef?: PreviewCaptureTarget }>) {
  const { ref: stageRef, width, height } = usePaneSize<HTMLDivElement>();
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const { style, scale } = deviceStyle(vm, { width, height });
  const label = scaleLabel(scale);
  const frameKey = vm.frameKey;

  return (
    <>
      <div className="qa-preview__caption">
        <span className="qa-preview__device">{captionText(vm)}</span>
        {label ? <span className="qa-preview__scale">{label}</span> : null}
      </div>
      <div className="qa-stage" data-frame={vm.device.frame} ref={stageRef}>
        <div
          className="qa-device"
          data-frame={vm.device.frame}
          data-orientation={vm.dimensions.orientation}
          style={style}
        >
          <div className="qa-device__chrome qa-device__bar" aria-hidden="true">
            <span className="qa-device__dots">
              <span />
              <span />
              <span />
            </span>
            <span className="qa-device__address">{addressLabel(url)}</span>
            <span className="qa-device__size">{dimensionsLabel(vm.dimensions)}</span>
          </div>
          <span className="qa-device__chrome qa-device__sensor" aria-hidden="true" />
          <span className="qa-device__chrome qa-device__home" aria-hidden="true" />
          <span className="qa-device__chrome qa-device__buttons qa-device__buttons--start" aria-hidden="true" />
          <span className="qa-device__chrome qa-device__buttons qa-device__buttons--end" aria-hidden="true" />
          <div className="qa-device__screen">
            {loadedKey === frameKey ? null : (
              <p className="qa-device__loading" role="status">
                Loading preview…
              </p>
            )}
            <iframe
              key={frameKey}
              ref={frameRef}
              className="qa-device__frame"
              onLoad={() => setLoadedKey(frameKey)}
              referrerPolicy="no-referrer"
              sandbox={sandbox}
              src={url}
              title={`Preview of ${vm.host ?? url}`}
            />
          </div>
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

function PaneContent({ vm, frameRef }: Readonly<{ vm: StudioViewportViewModel; frameRef?: PreviewCaptureTarget }>) {
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
  return <DeviceFrame vm={vm} url={vm.pageUrl} sandbox={vm.sandbox} frameRef={frameRef} />;
}

/**
 * `frameRef` receives the live iframe, so an item's "Capture" can crop a
 * screenshot of the tab to it. It changes nothing about the frame itself.
 */
export function PreviewPane({ vm, frameRef }: Readonly<{ vm: StudioViewportViewModel; frameRef?: PreviewCaptureTarget }>) {
  return (
    <section className="qa-preview" aria-label="Preview">
      <PaneContent vm={vm} frameRef={frameRef} />
    </section>
  );
}
