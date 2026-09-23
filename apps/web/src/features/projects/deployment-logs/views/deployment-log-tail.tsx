"use client";

import type {
  DeploymentLogFocus,
  LogWindow,
} from "../model/deployment-logs-types";
import { useDeploymentLogsViewModel } from "../view-models/use-deployment-logs-view-model";
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
    </section>
  );
}
