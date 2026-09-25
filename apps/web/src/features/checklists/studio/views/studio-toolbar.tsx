"use client";

import type { FormEvent, ReactNode } from "react";

import {
  DEVICE_PRESETS,
  devicePresetDetail,
  type DevicePresetId,
} from "../../model/qa-studio-rules";
import { commitLabel, commitSourceLabel } from "../../model/qa-run-rules";
import type { QaCommitSource } from "../../model/qa-run-types";
import type { StudioViewportViewModel } from "../view-models/use-studio-viewport-view-model";
import {
  ArrowRightIcon,
  BranchIcon,
  DesktopIcon,
  ExternalIcon,
  MobileIcon,
  ReloadIcon,
  TabletIcon,
  WarningIcon,
} from "./studio-icons";

const DEVICE_ICONS: Record<DevicePresetId, () => ReactNode> = {
  desktop: DesktopIcon,
  tablet: TabletIcon,
  mobile: MobileIcon,
};

function EnvironmentPicker({ vm }: Readonly<{ vm: StudioViewportViewModel }>) {
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
            {env.preview.isProduction ? " · production" : ""}
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
            {preset.width ? <span className="qa-device-switch__px">{preset.width}</span> : null}
          </button>
        );
      })}
    </div>
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

function FrameActions({ vm }: Readonly<{ vm: StudioViewportViewModel }>) {
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
}: Readonly<{
  vm: StudioViewportViewModel;
  commit: { commitSha: string | null; commitSource: QaCommitSource | null } | null;
}>) {
  return (
    <div className="qa-toolbar">
      <div className="qa-toolbar__row">
        <EnvironmentPicker vm={vm} />
        <DeviceSwitch vm={vm} />
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
        <FrameActions vm={vm} />
      </div>
      {vm.pathError ? (
        <p className="qa-form-error qa-toolbar__error" id="qa-route-error" role="alert">
          {vm.pathError}
        </p>
      ) : null}
    </div>
  );
}
