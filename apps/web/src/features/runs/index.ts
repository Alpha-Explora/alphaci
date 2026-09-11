/* Domain barrel — shared types and pure rules only.
 *
 * Actions are imported from their own slice (`@/features/runs/list`) so a
 * consumer pulls in one action rather than the whole domain. */
export type {
  BranchRunGroup,
  ProjectRunGroup,
  RunGroup,
  RunOverallStatus,
  RunsResponse,
  RunsStatus,
  RunsSummary,
  StageReport,
} from "./model/runs-types";

export {
  groupRunsByBranch,
  groupRunsByProject,
  summarizeRuns,
} from "./model/runs-rules";

/* How a tool's outcome reads. Pure rules, which is what this barrel is for,
 * and shared because the project workspace renders the same StageReport the
 * runs list does — the vocabulary should not be invented twice. */
export {
  checkLabel,
  checkTone,
  summarizeChecks,
} from "./model/runs-presentation";
export type { CheckSummary, CheckTone } from "./model/runs-presentation";
export * from "./data/runs-api";
