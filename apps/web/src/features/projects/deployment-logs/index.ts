/**
 * Deployment logs — the slice's public API.
 *
 * `DeploymentLogTail` is the Production Deployment card's log surface for a
 * backend target; `DeploymentLogsConsole` is the Hosting tab's full console.
 * Both own their ViewModel, so a consumer passes ids and a window, nothing
 * about how lines load.
 */
export { DeploymentLogTail } from "./views/deployment-log-tail";
export type { DeploymentLogTailProps } from "./views/deployment-log-tail";
export { DeploymentLogsConsole } from "./views/deployment-logs-console";
export type { DeploymentLogsConsoleProps } from "./views/deployment-logs-console";

export {
  useDeploymentLogsViewModel,
  type DeploymentLogsViewModel,
} from "./view-models/use-deployment-logs-view-model";

export type {
  DeploymentLogFocus,
  DeploymentLogLine,
  DeploymentLogsResponse,
  LogWindow,
} from "./model/deployment-logs-types";
