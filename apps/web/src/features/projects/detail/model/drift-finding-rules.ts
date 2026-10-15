import type {
  AppRole,
  ProjectDriftFinding,
  ProjectDriftRepairAction,
  ProjectDriftRepairResponse,
} from "@/shared/api/contracts";
import { canManageProjectLifecycle } from "./project-detail-tab-rules";

/**
 * Plain-language titles for the finding kinds this panel explains. A kind not
 * listed shows its code, which is how every kind read before.
 */
const TITLES = new Map<string, string>([
  ["ci_api_url_stale", "CI points at an old AlphaCI address"],
]);

export function driftFindingTitle(
  finding: Pick<ProjectDriftFinding, "code">,
): string {
  return TITLES.get(finding.code) ?? finding.code;
}

/**
 * The repair a finding offers here. Only kinds with a repair the backend
 * accepts are listed; a finding without one is shown without a button.
 */
const REPAIRS = new Map<string, ProjectDriftRepairAction>([
  ["ci_api_url_stale", "repair_ci_api_url"],
]);

export function driftRepairActionFor(
  finding: Pick<ProjectDriftFinding, "code">,
): ProjectDriftRepairAction | null {
  return REPAIRS.get(finding.code) ?? null;
}

export const DRIFT_REPAIR_LEAD_ONLY_MESSAGE =
  "A product owner or an admin applies this repair.";

/** The backend's gate for drift repairs: the same roles that manage the project. */
export function canRunDriftRepair(
  appRole: AppRole | null | undefined,
): boolean {
  return canManageProjectLifecycle(appRole);
}

/** Affected files as `branch: path`, one per line, for the finding's details. */
export function driftAffectedFiles(
  finding: Pick<ProjectDriftFinding, "details">,
): string[] {
  const files = finding.details["files"];
  if (!Array.isArray(files)) return [];
  return files.flatMap((file: unknown) => {
    if (typeof file !== "object" || file === null) return [];
    const { branch, path } = file as { branch?: unknown; path?: unknown };
    return typeof branch === "string" && typeof path === "string"
      ? [`${branch}: ${path}`]
      : [];
  });
}

/** The pull request a repair opened, or found already open, when it made one. */
export function driftPullRequestUrl(
  response: Pick<ProjectDriftRepairResponse, "result">,
): string | null {
  const url = response.result?.["pullRequestUrl"];
  return typeof url === "string" && url.length > 0 ? url : null;
}
