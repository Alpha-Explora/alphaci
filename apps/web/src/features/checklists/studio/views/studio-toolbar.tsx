"use client";

import { useId, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";

import {
  CUSTOM_RESOLUTION_LIMITS,
  CUSTOM_RESOLUTION_OPTION,
  DEVICE_PRESETS,
  RESOLUTION_PRESETS,
  resolutionLabel,
  validateCustomResolution,
  viewportLabel,
  type DevicePresetId,
} from "../../model/qa-studio-rules";
import { commitSourceLabel } from "../../model/qa-run-rules";
import type { QaCommitSource } from "../../model/qa-run-types";
import type { CopyLinkStatus } from "../view-models/use-copy-link";
import type { StudioViewportViewModel } from "../view-models/use-studio-viewport-view-model";
import {
  CheckIcon,
  CollapseIcon,
  DesktopIcon,
  ExpandIcon,
  ExternalIcon,
  LinkIcon,
  MobileIcon,
  ReloadIcon,
  RotateIcon,
  TabletIcon,
  WarningIcon,
} from "./studio-icons";

const DEVICE_ICONS: Record<DevicePresetId, () => ReactNode> = {
  desktop: DesktopIcon,
  tablet: TabletIcon,
  mobile: MobileIcon,
};

/** Copy link's three states: the icon and tooltip say it, the live region announces it. */
const COPY_LINK_ICONS: Record<CopyLinkStatus, () => ReactNode> = {
  idle: LinkIcon,
  copied: CheckIcon,
  failed: WarningIcon,
};

const COPY_LINK_TITLES: Record<CopyLinkStatus, string> = {
  idle: "Copy link to share",
  copied: "Copied",
  failed: "Couldn't copy",
};

/**
 * The environment under test is always the QA branch, so a single deployment
 * of it needs no control at all: nothing is shown. Only when two targets
 * deploy the branch (say, two frontends) is there a real choice, and then a
 * compact picker between them is the one thing that names an environment.
 */
function EnvironmentPicker({ vm }: Readonly<{ vm: StudioViewportViewModel }>) {
  if (vm.environments.length < 2) return null;
  return (
    <select
      className="hier-select qa-toolbar__select qa-toolbar__env"
      aria-label="Environment"
      title="Environment under test"
      value={vm.environment?.key ?? ""}
      onChange={(event) => vm.selectEnvironment(event.target.value)}
    >
      {vm.environments.map((env) => (
        <option key={env.key} value={env.key}>
          {env.label}
        </option>
      ))}
    </select>
  );
}

/** Desktop / Tablet / Mobile as icons: the name is the accessible name and the tooltip. */
function DeviceSwitch({ vm }: Readonly<{ vm: StudioViewportViewModel }>) {
  return (
    <div className="qa-device-switch" role="radiogroup" aria-label="Device class">
      {DEVICE_PRESETS.map((preset) => {
        const Icon = DEVICE_ICONS[preset.id];
        const selected = vm.device.id === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={preset.label}
            title={preset.label}
            className={`qa-device-switch__option${selected ? " qa-device-switch__option--on" : ""}`}
            onClick={() => vm.setDevice(preset.id)}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}

/**
 * A typed size, for a screen the presets miss. Applied on Enter or when a field
 * loses focus, never per keystroke: "1" on the way to "1920" is not a viewport.
 * An out-of-range size is refused with a message and the frame keeps its last
 * valid size. Keyed by device class, so each class starts from its own size.
 */
function CustomResolution({ vm }: Readonly<{ vm: StudioViewportViewModel }>) {
  const [width, setWidth] = useState(String(vm.resolution.width));
  const [height, setHeight] = useState(String(vm.resolution.height));
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const limits = CUSTOM_RESOLUTION_LIMITS;

  function apply() {
    const result = validateCustomResolution(width, height);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    vm.setCustomResolution(result.width, result.height);
  }

  function applyOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    apply();
  }

  const shared = {
    className: `qa-resolution__input${error ? " qa-resolution__input--invalid" : ""}`,
    type: "number",
    inputMode: "numeric",
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
    onBlur: apply,
    onKeyDown: applyOnEnter,
  } as const;

  return (
    <>
      <div className="qa-resolution__custom" role="group" aria-label="Custom resolution">
        <input
          {...shared}
          aria-label="Width in pixels"
          min={limits.minWidth}
          max={limits.maxWidth}
          value={width}
          onChange={(event) => setWidth(event.target.value)}
        />
        <span aria-hidden="true">×</span>
        <input
          {...shared}
          aria-label="Height in pixels"
          min={limits.minHeight}
          max={limits.maxHeight}
          value={height}
          onChange={(event) => setHeight(event.target.value)}
        />
      </div>
      {error ? (
        <p className="qa-form-error qa-toolbar__error qa-resolution__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

/**
 * The size the selected device class is viewed at: its presets, then "Custom…".
 * Picking one only restyles the frame (the page under test is not reloaded).
 * Rotatable classes list portrait sizes; Rotate turns whichever is chosen.
 */
function ResolutionPicker({ vm }: Readonly<{ vm: StudioViewportViewModel }>) {
  const custom = vm.resolution.preset === null;
  return (
    <div className="qa-resolution">
      <select
        className="hier-select qa-toolbar__select qa-resolution__select"
        aria-label={`${vm.device.label} resolution`}
        title="Resolution"
        value={custom ? CUSTOM_RESOLUTION_OPTION : vm.resolution.choice}
        onChange={(event) => vm.setResolution(event.target.value)}
      >
        {RESOLUTION_PRESETS[vm.device.id].map((preset) => (
          <option key={preset.id} value={preset.id}>
            {resolutionLabel(preset)}
          </option>
        ))}
        <option value={CUSTOM_RESOLUTION_OPTION}>Custom…</option>
      </select>
      {custom ? <CustomResolution key={vm.device.id} vm={vm} /> : null}
    </div>
  );
}

/**
 * Portrait ⇄ landscape, only for the devices that turn (Desktop has nothing to
 * rotate, so it gets no button rather than a disabled one). An icon: its
 * name says where it goes, and so which way the device is now.
 */
function RotateButton({ vm }: Readonly<{ vm: StudioViewportViewModel }>) {
  if (!vm.canRotate) return null;
  const next = vm.orientation === "portrait" ? "landscape" : "portrait";
  return (
    <button
      type="button"
      className="qa-icon-button qa-rotate"
      onClick={vm.rotate}
      aria-label={`Rotate to ${next}`}
      title={`Rotate to ${next}`}
    >
      <RotateIcon />
    </button>
  );
}

/**
 * How far the page is shrunk to fit, so a tester knows 48% is not how it
 * ships. Nothing at life size. The viewport is in its name and tooltip too,
 * since the preview shows no caption.
 */
function ScaleBadge({ vm }: Readonly<{ vm: StudioViewportViewModel }>) {
  if (!vm.scalePercent || !vm.scaleLabel) return null;
  const name = `${vm.scaleLabel} · ${viewportLabel(vm.device, vm.dimensions)}`;
  return (
    <span className="qa-scale" title={name}>
      <span aria-hidden="true">{vm.scalePercent}</span>
      <span className="sr-only">{name}</span>
    </span>
  );
}

/**
 * The one thing the commit tells a tester that the page does not: that the
 * commit under test is the branch head, NOT what is deployed, so what they see
 * may not be what they are signing off. A deployed commit says nothing here.
 */
function CommitSourceWarning({ commitSource }: Readonly<{ commitSource: QaCommitSource | null }>) {
  if (commitSource !== "branch_head") return null;
  return (
    <span className="qa-commit-warning">
      <WarningIcon />
      {commitSourceLabel(commitSource)}
    </span>
  );
}

/**
 * Copies the environment's page URL, to share with someone who is not in the
 * studio. The live region is always rendered (a region added together with its
 * text is not reliably announced) and says nothing until a copy has happened.
 */
function CopyLinkButton({ vm }: Readonly<{ vm: StudioViewportViewModel }>) {
  const status = vm.copyLinkStatus;
  const Icon = COPY_LINK_ICONS[status];
  return (
    <>
      <button
        type="button"
        className="qa-icon-button"
        data-status={status}
        onClick={() => void vm.copyLink()}
        disabled={!vm.pageUrl}
        aria-label="Copy link"
        title={COPY_LINK_TITLES[status]}
      >
        <Icon />
      </button>
      <span className="sr-only" role="status">
        {status === "idle" ? "" : COPY_LINK_TITLES[status]}
      </span>
    </>
  );
}

function FrameActions({
  vm,
  fullScreenRef,
}: Readonly<{ vm: StudioViewportViewModel; fullScreenRef?: Ref<HTMLButtonElement> }>) {
  return (
    <div className="qa-toolbar__actions">
      <button
        type="button"
        className="qa-icon-button"
        onClick={vm.reload}
        disabled={!vm.canFrame}
        aria-label="Reload preview"
        title="Reload preview"
      >
        <ReloadIcon />
      </button>
      <CopyLinkButton vm={vm} />
      {vm.pageUrl ? (
        <a
          className="qa-icon-button"
          href={vm.pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open in new tab"
          title="Open in new tab"
        >
          <ExternalIcon />
        </a>
      ) : null}
      <button
        ref={fullScreenRef}
        type="button"
        className="qa-icon-button qa-icon-button--full-screen"
        onClick={vm.toggleFullScreen}
        aria-pressed={vm.isFullScreen}
        aria-label="Full screen"
        title={vm.isFullScreen ? "Exit full screen (Esc)" : "Full screen"}
      >
        {vm.isFullScreen ? <CollapseIcon /> : <ExpandIcon />}
      </button>
    </div>
  );
}

/**
 * Where the controls are drawn. `tab-row`: borderless, in the project page's
 * tab row (docked). `studio`: a slim bar across the top of the studio itself —
 * in full screen, where the tab row is covered, and wherever no tab row hosts it.
 */
export type StudioToolbarPlacement = "tab-row" | "studio";

/**
 * The studio's controls, one row: at what size (device class, resolution,
 * rotation), which deployment when the QA branch has two, a warning when the
 * commit under test is not the deployed one, and the frame's actions. The
 * commit comes from the run lookup, because the server — not the preview card —
 * decides which sha a run is recorded against.
 */
export function StudioToolbar({
  vm,
  commit,
  fullScreenRef,
  placement = "studio",
}: Readonly<{
  vm: StudioViewportViewModel;
  commit: { commitSha: string | null; commitSource: QaCommitSource | null } | null;
  /** The Full screen toggle, so focus can return to it when the drawer's Dock button disappears. */
  fullScreenRef?: Ref<HTMLButtonElement>;
  placement?: StudioToolbarPlacement;
}>) {
  return (
    <div className="qa-toolbar" data-placement={placement} role="group" aria-label="Preview controls">
      <div className="qa-toolbar__row">
        <EnvironmentPicker vm={vm} />
        <DeviceSwitch vm={vm} />
        <ResolutionPicker vm={vm} />
        <RotateButton vm={vm} />
        <ScaleBadge vm={vm} />
        <CommitSourceWarning commitSource={commit?.commitSource ?? null} />
        <FrameActions vm={vm} fullScreenRef={fullScreenRef} />
      </div>
    </div>
  );
}
