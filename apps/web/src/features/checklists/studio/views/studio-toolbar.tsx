"use client";

import type { FormEvent, ReactNode, Ref } from "react";

import {
  DEVICE_PRESETS,
  devicePresetDetail,
  orientationLabel,
  STUDIO_LAYOUTS,
  type DevicePresetId,
  type StudioLayout,
} from "../../model/qa-studio-rules";
import { commitLabel, commitSourceLabel } from "../../model/qa-run-rules";
import type { QaCommitSource } from "../../model/qa-run-types";
import type { StudioViewportViewModel } from "../view-models/use-studio-viewport-view-model";
import {
  ArrowRightIcon,
  BranchIcon,
  CollapseIcon,
  DesktopIcon,
  ExpandIcon,
  ExternalIcon,
  LayoutSplitIcon,
  LayoutWideIcon,
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

const LAYOUT_ICONS: Record<StudioLayout, () => ReactNode> = {
  wide: LayoutWideIcon,
  split: LayoutSplitIcon,
};

/**
 * The environment under test. Only ever the QA branch: with one deployment it
 * is a fixed chip, with two targets on the branch it is a picker between them.
 */
function EnvironmentPicker({ vm }: Readonly<{ vm: StudioViewportViewModel }>) {
  if (vm.environments.length === 1) {
    return (
      <div className="qa-toolbar__env">
        <span className="qa-toolbar__label">Environment</span>
        <span className="qa-toolbar__env-chip">
          <BranchIcon />
          {vm.environments[0].label}
        </span>
      </div>
    );
  }
  return (
    <label className="qa-toolbar__env">
      <span className="qa-toolbar__label">Environment</span>
      <select
        className="hier-select qa-toolbar__select"
        value={vm.environment?.key ?? ""}
        onChange={(event) => vm.selectEnvironment(event.target.value)}
      >
        {vm.environments.map((env) => (
          <option key={env.key} value={env.key}>
            {env.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DeviceSwitch({ vm }: Readonly<{ vm: StudioViewportViewModel }>) {
  return (
    <div className="qa-device-switch" role="radiogroup" aria-label="Device width">
      {DEVICE_PRESETS.map((preset) => {
        const Icon = DEVICE_ICONS[preset.id];
        const selected = vm.device.id === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={selected}
            title={`${preset.label} · ${devicePresetDetail(preset)}`}
            className={`qa-device-switch__option${selected ? " qa-device-switch__option--on" : ""}`}
            onClick={() => vm.setDevice(preset.id)}
          >
            <Icon />
            <span>{preset.label}</span>
            <span className="qa-device-switch__px">{preset.width}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Portrait ⇄ landscape, for the devices that turn. The caption says which it is now. */
function RotateButton({ vm }: Readonly<{ vm: StudioViewportViewModel }>) {
  const next = vm.orientation === "portrait" ? "landscape" : "portrait";
  return (
    <button
      type="button"
      className="qa-rotate"
      onClick={vm.rotate}
      disabled={!vm.canRotate}
      title={vm.canRotate ? `Rotate to ${next}` : `${vm.device.label} does not rotate`}
    >
      <RotateIcon />
      <span>Rotate</span>
      <span className="qa-rotate__state" aria-hidden="true">{orientationLabel(vm.dimensions.orientation)}</span>
    </button>
  );
}

function RouteField({ vm }: Readonly<{ vm: StudioViewportViewModel }>) {
  const host = vm.host;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    vm.submitPath();
  }

  return (
    <form className="qa-route" onSubmit={handleSubmit} role="search" aria-label="Route under test">
      <label className={`qa-route__box${vm.pathError ? " qa-route__box--invalid" : ""}`}>
        <span className="sr-only">Route on {host ?? "the environment"}</span>
        {host ? <span className="qa-route__host">{host}</span> : null}
        <input
          className="qa-route__input"
          value={vm.pathDraft}
          disabled={!host}
          spellCheck={false}
          autoComplete="off"
          placeholder="/"
          aria-invalid={vm.pathError ? true : undefined}
          aria-describedby={vm.pathError ? "qa-route-error" : undefined}
          onChange={(event) => vm.setPathDraft(event.target.value)}
        />
      </label>
      <button type="submit" className="qa-icon-button" disabled={!host} aria-label="Go to route" title="Go">
        <ArrowRightIcon />
      </button>
    </form>
  );
}

/**
 * Wide preview ⇄ Split, beside Full screen. Toggle buttons (aria-pressed) in a
 * fieldset named "Layout", so each is a plain Tab stop that Enter or Space switches — no hotkey,
 * which would fire inside notes and never inside the cross-origin frame.
 * Rendered only while docked: full screen has no columns to share, and below
 * 1100px, where the panes stack, CSS hides it too.
 */
function LayoutSwitch({ vm }: Readonly<{ vm: StudioViewportViewModel }>) {
  if (vm.isFullScreen) return null;
  return (
    <fieldset className="qa-layout-switch">
      <legend className="sr-only">Layout</legend>
      {STUDIO_LAYOUTS.map((option) => {
        const Icon = LAYOUT_ICONS[option.id];
        const selected = vm.layout === option.id;
        return (
          <button
            key={option.id}
            type="button"
            className="qa-layout-switch__option"
            aria-pressed={selected}
            aria-label={option.label}
            title={option.hint}
            onClick={() => vm.setLayout(option.id)}
          >
            <Icon />
          </button>
        );
      })}
    </fieldset>
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
      <LayoutSwitch vm={vm} />
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

/** "main @ abc1234" and whether that commit is what is deployed. */
export function CommitChip({
  branch,
  commitSha,
  commitSource,
}: Readonly<{ branch: string; commitSha: string | null; commitSource: QaCommitSource | null }>) {
  const source = commitSourceLabel(commitSource);
  return (
    <div className="qa-commit" aria-label="Commit under test">
      <span className="qa-commit__ref">
        <BranchIcon />
        <code>{commitLabel(branch, commitSha)}</code>
      </span>
      {source ? (
        <span className={`qa-commit__source qa-commit__source--${commitSource}`}>
          {commitSource === "branch_head" ? <WarningIcon /> : null}
          {source}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The studio's controls: what to test (environment), at what size (device),
 * where (route), and the commit that answers there. The commit comes from the
 * run lookup, because the server — not the preview card — decides which sha a
 * run is recorded against.
 */
export function StudioToolbar({
  vm,
  commit,
  fullScreenRef,
}: Readonly<{
  vm: StudioViewportViewModel;
  commit: { commitSha: string | null; commitSource: QaCommitSource | null } | null;
  /** The Full screen toggle, so focus can return to it when the drawer's Dock button disappears. */
  fullScreenRef?: Ref<HTMLButtonElement>;
}>) {
  return (
    <div className="qa-toolbar">
      <div className="qa-toolbar__row">
        <EnvironmentPicker vm={vm} />
        <DeviceSwitch vm={vm} />
        <RotateButton vm={vm} />
        {commit && vm.environment ? (
          <CommitChip
            branch={vm.environment.branch}
            commitSha={commit.commitSha}
            commitSource={commit.commitSource}
          />
        ) : null}
      </div>
      {/* The address bar: where in the environment, and the browser actions for it. */}
      <div className="qa-toolbar__row qa-toolbar__row--address">
        <RouteField vm={vm} />
        <FrameActions vm={vm} fullScreenRef={fullScreenRef} />
      </div>
      {vm.pathError ? (
        <p className="qa-form-error qa-toolbar__error" id="qa-route-error" role="alert">
          {vm.pathError}
        </p>
      ) : null}
    </div>
  );
}
