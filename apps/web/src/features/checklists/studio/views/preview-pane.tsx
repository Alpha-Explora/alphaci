"use client";

import { useState, type CSSProperties } from "react";

import { frameChrome, viewportLabel } from "../../model/qa-studio-rules";
import type { PreviewCaptureTarget } from "../view-models/preview-capture-target";
import type { StudioViewportViewModel } from "../view-models/use-studio-viewport-view-model";
import { ExternalIcon } from "./studio-icons";

/** The CSS custom properties one device is drawn from. */
function deviceStyle(vm: StudioViewportViewModel): CSSProperties {
  const { width, height, orientation } = vm.dimensions;
  const chrome = frameChrome(vm.device.frame, orientation);
  return {
    "--qa-screen-w": width,
    "--qa-screen-h": height,
    "--qa-scale": vm.scale,
    "--qa-chrome-top": `${chrome.top}px`,
    "--qa-chrome-right": `${chrome.right}px`,
    "--qa-chrome-bottom": `${chrome.bottom}px`,
    "--qa-chrome-left": `${chrome.left}px`,
  } as CSSProperties;
}

/**
 * The live page, drawn at the device's true viewport. Desktop is the page
 * itself, edge to edge, with no mock browser window around it; a tablet or a
 * phone keeps its hardware, which is what tells a tester which one they see.
 *
 * ONE DOM for every device, orientation and for full screen: the hardware
 * parts (bezel sensor, home bar, side buttons) are always rendered and CSS
 * shows the ones the frame has. Switching device or rotating changes only
 * `data-*` attributes and custom properties, so React never re-creates the
 * iframe and the site under test keeps its scroll, form input and login.
 *
 * The page lays out at the device's real size; only the screen is scaled to
 * fit the stage (by both axes). The toolbar prints the scale, so a tester
 * knows 48% is not how it ships. The hardware is not scaled, so it stays
 * legible, and it sits outside the screen so it never covers a fixed header.
 */
function DeviceFrame({
  vm,
  url,
  sandbox,
  frameRef,
}: Readonly<{ vm: StudioViewportViewModel; url: string; sandbox: string; frameRef?: PreviewCaptureTarget }>) {
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const { frameKey, attachStage } = vm;

  return (
    <div className="qa-stage" data-frame={vm.device.frame} ref={attachStage}>
      {/* No visible caption: the page gets the room. A screen reader still hears the viewport. */}
      <p className="sr-only qa-preview__device">{viewportLabel(vm.device, vm.dimensions)}</p>
      <div
        className="qa-device"
        data-frame={vm.device.frame}
        data-orientation={vm.dimensions.orientation}
        style={deviceStyle(vm)}
      >
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
