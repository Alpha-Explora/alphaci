/* Domain barrel — shared types and pure rules only.
 *
 * Actions are imported from their own slice (`@/features/runs/list`) so a
 * consumer pulls in one action rather than the whole domain. */
export type {
  ProjectRunGroup,
  RunGroup,
  RunOverallStatus,
  RunsResponse,
  RunsStatus,
  RunsSummary,
  StageReport,
} from "./model/runs-types";

export { groupRunsByProject, summarizeRuns } from "./model/runs-rules";
