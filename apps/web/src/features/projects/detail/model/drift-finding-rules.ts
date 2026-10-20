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

/**
 * The number of the pull request a repair opened, or found already open, so
 * it opens in the Pull requests tab: from `pullRequestNumber`, else read off
 * the end of `pullRequestUrl`. The GitHub address itself is never linked.
 */
export function driftPullRequestNumber(
  response: Pick<ProjectDriftRepairResponse, "result">,
): number | null {
  const number = response.result?.["pullRequestNumber"];
  if (typeof number === "number" && Number.isInteger(number) && number > 0) return number;
  const url = response.result?.["pullRequestUrl"];
  const match = typeof url === "string" ? /\/pull\/(\d+)(?:[/?#]|$)/.exec(url) : null;
  return match ? Number(match[1]) : null;
}

/**
 * A repair's sentence without GitHub addresses: "Opened a pull request into
 * dev: https://github.com/…/pull/42" reads "Opened a pull request into dev.",
 * and the pull request opens in the app instead.
 */
export function driftRepairMessage(message: string): string {
  return message
    .replace(/:?\s*https?:\/\/(?:www\.)?github\.com\/\S*/gi, "")
    .replace(/\s+([.,;])/g, "$1")
    .trim()
    .replace(/([^.!?])$/, "$1.");
}

/**
 * The branch a repair proposes its pull request into, as detection recorded it.
 * Null for a finding raised before the base was recorded.
 */
export function driftRepairBaseBranch(
  finding: Pick<ProjectDriftFinding, "details">,
): string | null {
  const base = finding.details["baseBranch"];
  return typeof base === "string" && base.length > 0 ? base : null;
}
