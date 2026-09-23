"use client";

import { useEffect, useRef, useState } from "react";

import type { LogQueryFilters, LogWindow } from "../model/deployment-logs-types";
import {
  rangeOptions,
  rangeWindow,
  type LogRangePreset,
} from "../model/log-format";
import {
  useDeploymentLogsViewModel,
  type DeploymentLogsViewModel,
} from "../view-models/use-deployment-logs-view-model";
import { LogBody, LogSourceBadge, TimeZoneLabel } from "./log-parts";

type TypeChoice = "" | NonNullable<LogQueryFilters["type"]>;

export interface DeploymentLogsConsoleProps {
  projectId: string;
  targetId: string;
  /** The service's name at the host, for the heading. */
  targetName: string;
  /** The host's display name. */
  providerLabel: string;
  /** The current deploy's window, when known; enables "This deploy". */
  deployWindow?: LogWindow | null;
  /** Scroll the console into view on mount (opened from the Overview card). */
  focusOnMount?: boolean;
}

function TypeSelect({
  value,
  onChange,
}: Readonly<{ value: TypeChoice; onChange: (value: TypeChoice) => void }>) {
  return (
    <select
      aria-label="Log type"
      className="deploy-logs__control"
      onChange={(event) => onChange(event.target.value as TypeChoice)}
      value={value}
    >
      <option value="">All logs</option>
      <option value="build">Build</option>
      <option value="app">App</option>
    </select>
  );
}

function RangeSelect({
  value,
  deployWindow,
  onChange,
}: Readonly<{
  value: LogRangePreset;
  deployWindow: LogWindow | null;
  onChange: (value: LogRangePreset) => void;
}>) {
  return (
    <select
      aria-label="Time range"
      className="deploy-logs__control"
      onChange={(event) => onChange(event.target.value as LogRangePreset)}
      value={value}
    >
      {rangeOptions(deployWindow).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** Server-side filters, rendered only for the ones this provider supports. */
function ConsoleFilters({
  vm,
  type,
  onType,
}: Readonly<{
  vm: DeploymentLogsViewModel;
  type: TypeChoice;
  onType: (value: TypeChoice) => void;
}>) {
  const supports = (key: (typeof vm.supportedFilters)[number]) =>
    vm.supportedFilters.includes(key);
  return (
    <>
      {supports("type") ? <TypeSelect onChange={onType} value={type} /> : null}
      {supports("level") ? (
        <label className="deploy-logs__toggle">
          <input
            checked={vm.errorsOnly}
            onChange={vm.toggleErrorsOnly}
            type="checkbox"
          />
          Errors only ({vm.errorCount})
        </label>
      ) : null}
      {supports("text") ? (
        <input
          aria-label="Search logs"
          className="deploy-logs__control deploy-logs__control--search"
          onChange={(event) => vm.setSearch(event.target.value)}
          placeholder="Search logs"
          type="search"
          value={vm.search}
        />
      ) : null}
    </>
  );
}

/**
 * The Hosting tab's full log console for one target: build and app lines,
 * errors only, a server-side search, time ranges, and older pages on request.
 */
export function DeploymentLogsConsole({
  projectId,
  targetId,
  targetName,
  providerLabel,
  deployWindow = null,
  focusOnMount = false,
}: Readonly<DeploymentLogsConsoleProps>) {
  const [range, setRange] = useState<LogRangePreset>(deployWindow ? "deploy" : "1h");
  const [logWindow, setLogWindow] = useState<LogWindow | null>(() =>
    rangeWindow(deployWindow ? "deploy" : "1h", Date.now(), deployWindow),
  );
  const [type, setType] = useState<TypeChoice>("");
  const vm = useDeploymentLogsViewModel({
    projectId,
    targetId,
    window: logWindow,
    filters: { type: type || null },
  });

  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focusOnMount) root.current?.scrollIntoView?.({ block: "start" });
  }, [focusOnMount]);

  function chooseRange(preset: LogRangePreset) {
    setRange(preset);
    setLogWindow(rangeWindow(preset, Date.now(), deployWindow));
  }

  return (
    <section
      aria-label={`${providerLabel} logs for ${targetName}`}
      className="deploy-logs-console"
      ref={root}
    >
      <div className="deploy-logs-console__head">
        <h5 className="deploy-logs-console__title">
          Logs · {targetName}
          <LogSourceBadge source={vm.source} tail={vm.tail} />
        </h5>
        <div className="deploy-logs-console__controls">
          <ConsoleFilters onType={setType} type={type} vm={vm} />
          <RangeSelect deployWindow={deployWindow} onChange={chooseRange} value={range} />
          <TimeZoneLabel at={vm.lines[0]?.timestamp ?? logWindow?.startTime ?? null} />
        </div>
      </div>
      <div className="deploy-logs__body deploy-logs-console__lines">
        <LogBody label={`Log lines for ${targetName}`} providerLabel={providerLabel} vm={vm} />
      </div>
    </section>
  );
}
