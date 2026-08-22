/* Pure rules for the home dashboard. No React, no Next, no fetch — all of this
 * is directly callable from a test. It came out of a 1,492-line route where the
 * only way to assert any of it was to render the page. */
export { isGroupManagerRole } from "@/lib/api/hierarchy-contracts";

import type {
  ConnectorTone,
  ProjectTone,
  ProvisionedProject,
  RunGroup,
  RunStats,
  StageId,
  StageStatus,
} from "./home-types";

export const RUN_STAGE_ORDER: StageId[] = ["access", "quality", "package"];

export const RUN_STAGE_LABELS: Record<StageId, string> = {
  access: "Access",
  quality: "Quality",
  package: "Package",
};

/**
 * Coarse relative time: "just now", "12m ago", "5h ago", "3d ago".
 *
 * Reads the clock, so a caller that needs determinism passes `now`.
 */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** "acme/orders-api" -> "orders-api". Falls back to the whole string. */
export function shortRepoName(repoFullName: string | null | undefined): string {
  if (!repoFullName) return "Repository";
  return repoFullName.split("/")[1] ?? repoFullName;
}

/** Status-badge tone for a provisioned project. */
export function projectTone(status: ProvisionedProject["status"]): ProjectTone {
  if (status === "provisioned") return "ok";
  if (status === "provisioning") return "warn";
  if (status === "failed") return "danger";
  return "muted"; // orphaned
}

/** Human label for a provisioned-project status. */
export function projectBadgeLabel(status: ProvisionedProject["status"]): string {
  if (status === "provisioned") return "Active";
  if (status === "provisioning") return "Provisioning";
  if (status === "failed") return "Failed";
  return "Idle"; // orphaned
}

/**
 * Colour a connector segment from the stages it links: green while progress
 * holds, red into a failing stage, an animated flow into a running stage.
 */
export function connectorTone(
  prev: StageStatus,
  next: StageStatus,
): ConnectorTone {
  if (next === "failure") return "danger";
  if (prev === "success" && next === "success") return "success";
  if (prev === "success" && next === "running") return "flowing";
  return "pending";
}

/**
 * Run analytics over the recent-runs window.
 *
 * Rate and breakdown use the newest 10; `running` and `failureStreak` read the
 * whole list, because an in-flight run or an ongoing outage outside that window
 * still matters to someone looking at the dashboard.
 */
export function computeRunStats(runs: RunGroup[]): RunStats {
  const sample = runs.slice(0, 10);
  const finished = sample.filter((run) => run.overallStatus !== "running");
  const successes = sample.filter(
    (run) => run.overallStatus === "success",
  ).length;
  const failures = sample.filter(
    (run) => run.overallStatus === "failure",
  ).length;
  const running = runs.filter((run) => run.overallStatus === "running").length;

  const successRate = finished.length
    ? Math.round(
        (finished.filter((run) => run.overallStatus === "success").length /
          finished.length) *
          100,
      )
    : null;

  const stageFailures: Record<StageId, number> = {
    access: 0,
    quality: 0,
    package: 0,
  };
  for (const run of sample) {
    for (const stage of run.stages) {
      if (stage.status === "failure") stageFailures[stage.stage] += 1;
    }
  }
  const rankedStages = (
    Object.entries(stageFailures) as Array<[StageId, number]>
  ).sort((a, b) => b[1] - a[1]);
  const worstStage =
    rankedStages[0] && rankedStages[0][1] > 0
      ? { stage: rankedStages[0][0], count: rankedStages[0][1] }
      : null;

  let failureStreak = 0;
  for (const run of runs) {
    if (run.overallStatus === "failure") failureStreak += 1;
    else break;
  }

  return {
    sample,
    successRate,
    finishedCount: finished.length,
    successes,
    failures,
    running,
    worstStage,
    failureStreak,
    outcomes: runs.map((run) => run.overallStatus),
  };
}
