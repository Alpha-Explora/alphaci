"use client";

import type {
  DeploymentLogFocus,
  LogWindow,
} from "../model/deployment-logs-types";
import { formatLogTime } from "../model/log-format";
import { quietAgo, quietSince } from "../model/log-quiet";
import { useDeploymentLogsViewModel } from "../view-models/use-deployment-logs-view-model";
import { useMinuteClock } from "../view-models/use-minute-clock";
import { ErrorsChip, LogBody, LogSourceBadge, TimeZoneLabel } from "./log-parts";

export interface DeploymentLogTailProps {
  projectId: string;
  targetId: string;
  /** The current deploy's window. `endTime: null` while it is the live one. */
  logWindow: LogWindow;
  /** The host's display name, from the backend's provider descriptor. */
  providerLabel: string;
  /** Opens the full console for this target. Omitted, the link is not shown. */
  onOpenFullLogs?: (focus: DeploymentLogFocus) => void;
}

/**
 * Said under a live tail that has been silent for a while, so a sleeping free
 * instance does not read as a stale or broken log.
 */
function QuietNote({ since, now }: Readonly<{ since: string; now: number }>) {
  return (
    <p className="deploy-logs-tail__quiet">
      No new lines since {formatLogTime(since)}, {quietAgo(since, now)}. The service may be asleep: a free instance
      stops after 15 minutes without traffic and starts again on the next request.
    </p>
  );
}

/**
 * The Production Deployment card's log slot for a backend target: the current
 * deploy's build and runtime lines, live-tailed, in about the space the page
 * thumbnail takes on a frontend card.
 */
export function DeploymentLogTail({
  projectId,
  targetId,
  logWindow,
  providerLabel,
  onOpenFullLogs,
}: Readonly<DeploymentLogTailProps>) {
  const vm = useDeploymentLogsViewModel({ projectId, targetId, window: logWindow });
  const now = useMinuteClock();
  const since = vm.source === "live" && logWindow.endTime === null ? quietSince(vm.lines, now) : null;

  return (
    <section aria-label={`${providerLabel} deploy logs`} className="deploy-logs-tail">
      <div className="deploy-logs-tail__bar">
        <LogSourceBadge source={vm.source} tail={vm.tail} />
        <ErrorsChip vm={vm} />
        <TimeZoneLabel at={vm.lines[0]?.timestamp ?? null} />
        <span aria-hidden="true" className="deploy-logs-tail__spacer" />
        {onOpenFullLogs ? (
          <button
            className="deploy-logs-tail__open"
            onClick={() => onOpenFullLogs({ targetId, window: logWindow })}
            type="button"
          >
            Open full logs
          </button>
        ) : null}
      </div>
      <div className="deploy-logs__body">
        <LogBody label="Deploy log lines" providerLabel={providerLabel} vm={vm} />
      </div>
      {since ? <QuietNote since={since} now={now} /> : null}
    </section>
  );
}
