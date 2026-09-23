"use client";

import type { LogSource } from "../model/deployment-logs-types";
import { timeZoneAbbreviation } from "../model/log-format";
import type {
  DeploymentLogsViewModel,
  LogTailState,
} from "../view-models/use-deployment-logs-view-model";
import { LogLineList } from "./log-line-list";

type BadgeKind = "live" | "simulated" | "unavailable" | "idle";

const TAIL_LABEL: Record<LogTailState, string> = {
  off: "Not tailing",
  connecting: "Connecting…",
  live: "Live",
  paused: "Paused while hidden",
  closed: "Fixed range",
};

/**
 * What the lines are. A simulated line is never labelled live, whatever the
 * connection is doing: the source decides first, the tail second.
 */
function badgeFor(
  tail: LogTailState,
  source: LogSource | null,
): { kind: BadgeKind; label: string } {
  if (source === "simulated") return { kind: "simulated", label: "Simulated (local mock)" };
  if (source === "unavailable") return { kind: "unavailable", label: "Unavailable" };
  if (tail === "live" && source === "live") return { kind: "live", label: "Live" };
  return { kind: "idle", label: TAIL_LABEL[tail] };
}

export function LogSourceBadge({
  tail,
  source,
}: Readonly<{ tail: LogTailState; source: LogSource | null }>) {
  const badge = badgeFor(tail, source);
  return (
    <span className={`deploy-logs__badge deploy-logs__badge--${badge.kind}`}>
      <span aria-hidden="true" className="deploy-logs__dot" />
      {badge.label}
    </span>
  );
}

/**
 * "Errors (N)". A toggle when the provider can filter by level server-side,
 * otherwise only the count, so the control never promises a filter it lacks.
 */
export function ErrorsChip({
  vm,
}: Readonly<{ vm: Pick<DeploymentLogsViewModel, "errorCount" | "errorsOnly" | "toggleErrorsOnly" | "supportedFilters"> }>) {
  const label = `Errors (${vm.errorCount})`;
  if (!vm.supportedFilters.includes("level")) {
    if (vm.errorCount === 0) return null;
    return (
      <span className="deploy-logs__chip deploy-logs__chip--danger deploy-logs__chip--static">
        {label}
      </span>
    );
  }
  const tone = vm.errorCount > 0 ? " deploy-logs__chip--danger" : "";
  return (
    <button
      aria-pressed={vm.errorsOnly}
      className={`deploy-logs__chip${tone}`}
      onClick={vm.toggleErrorsOnly}
      title={vm.errorsOnly ? "Show every line" : "Show errors only"}
      type="button"
    >
      {label}
    </button>
  );
}

/** The viewer's own timezone, next to the times it applies to. */
export function TimeZoneLabel({ at }: Readonly<{ at: string | null }>) {
  if (!at) return null;
  const zone = timeZoneAbbreviation(new Date(at));
  if (!zone) return null;
  return <span className="deploy-logs__zone">Times in {zone}</span>;
}

function LogNotices({
  vm,
  providerLabel,
}: Readonly<{
  vm: DeploymentLogsViewModel;
  providerLabel: string;
}>) {
  return (
    <>
      {vm.source === "unavailable" ? (
        <p className="deploy-logs__notice deploy-logs__notice--danger" role="status">
          <strong>{providerLabel} logs are unavailable.</strong>{" "}
          {vm.reason ?? "The provider did not answer."}
        </p>
      ) : null}
      {vm.source === "simulated" && vm.reason ? (
        <p className="deploy-logs__notice" role="status">
          Simulated lines from the local mock, not {providerLabel}: {vm.reason}
        </p>
      ) : null}
      {!vm.atLive ? (
        <p className="deploy-logs__notice" role="status">
          Showing older lines; new ones are held back.{" "}
          <button className="deploy-logs__older-button" onClick={vm.restart} type="button">
            Back to live
          </button>
        </p>
      ) : null}
      {vm.error && vm.status === "ready" ? (
        <p className="deploy-logs__notice deploy-logs__notice--danger" role="alert">
          {vm.error}{" "}
          <button className="deploy-logs__older-button" onClick={vm.restart} type="button">
            Retry
          </button>
        </p>
      ) : null}
    </>
  );
}

function emptyText(vm: DeploymentLogsViewModel): string {
  if (vm.errorsOnly) return "No errors in this range.";
  if (vm.search.trim()) return "No lines match this search.";
  return "No log lines in this range yet.";
}

function LogBodyState({ vm }: Readonly<{ vm: DeploymentLogsViewModel }>) {
  if (vm.status === "error") {
    return (
      <div className="deploy-logs__frame">
        <p className="deploy-logs__state deploy-logs__state--error" role="alert">
          {vm.error}
        </p>
      </div>
    );
  }
  const text = vm.status === "ready" ? emptyText(vm) : "Loading logs…";
  return (
    <div className="deploy-logs__frame">
      <p className="deploy-logs__state">{text}</p>
    </div>
  );
}

/**
 * Notices, then the lines, or the state standing in for them. An unavailable
 * provider shows its reason and no lines unless real lines already arrived
 * before it stopped answering: those stay, since they are still true.
 */
export function LogBody({
  vm,
  providerLabel,
  label,
}: Readonly<{
  vm: DeploymentLogsViewModel;
  providerLabel: string;
  label: string;
}>) {
  const hasLines = vm.status === "ready" && vm.lines.length > 0;
  const silent = vm.source === "unavailable" && !hasLines;
  return (
    <>
      <LogNotices providerLabel={providerLabel} vm={vm} />
      {hasLines ? (
        <LogLineList
          label={label}
          lines={vm.lines}
          older={vm.older}
          onLoadOlder={vm.loadOlder}
        />
      ) : silent ? null : (
        <LogBodyState vm={vm} />
      )}
    </>
  );
}
