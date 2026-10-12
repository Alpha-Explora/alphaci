/* Home's reading of the team's runs (GET /ci/runs). Pure: no React, no fetch.
 *
 * Runs carry a repository's full name, not a Project id, so a run belongs to
 * a Project through the repositories the Projects list files under it. Names
 * are matched without regard to case, as GitHub does. */

import { projectPageHref } from "./home-persona-rules";
import type {
  BranchHealthRow,
  BranchName,
  HomeScope,
  RepoRunTone,
  UatAutomationRow,
} from "./home-persona-types";
import type {
  ProjectFolder,
  ProvisionedProject,
  RunGroup,
  RunOverallStatus,
} from "./home-types";

export const HEALTH_BRANCHES: ReadonlyArray<BranchName> = ["dev", "uat", "main"];

/** A run row without a name (malformed) keys as "" and is never matched or listed. */
function repoKey(repoFullName: string): string {
  return (repoFullName || "").toLowerCase();
}

function startedAt(run: RunGroup): number {
  const time = Date.parse(run.startedAt);
  return Number.isNaN(time) ? 0 : time;
}

/** Newest first. Stable, so runs that started together keep the server's order. */
export function runsNewestFirst(runs: ReadonlyArray<RunGroup>): RunGroup[] {
  return [...runs].sort((a, b) => startedAt(b) - startedAt(a));
}

/** Failures first, each group in the order given. */
export function runsFailuresFirst(runs: ReadonlyArray<RunGroup>): RunGroup[] {
  const failing = runs.filter((run) => run.overallStatus === "failure");
  return [...failing, ...runs.filter((run) => run.overallStatus !== "failure")];
}

/** The full names of the repositories filed under these Projects, keyed for matching. */
export function repoKeysOf(folders: ReadonlyArray<ProjectFolder>): Set<string> {
  const keys = new Set<string>();
  for (const folder of folders) {
    for (const repository of folder.repositories) {
      if (repository.repoFullName) keys.add(repoKey(repository.repoFullName));
    }
  }
  return keys;
}

/**
 * The runs a role's blocks show. "My Projects" narrows to their repositories;
 * a team-wide scope keeps every team run, filed or not.
 */
export function runsInScope(
  runs: ReadonlyArray<RunGroup>,
  scope: HomeScope,
  scopedFolders: ReadonlyArray<ProjectFolder>,
): RunGroup[] {
  if (scope.mode !== "mine") return [...runs];
  const keys = repoKeysOf(scopedFolders);
  return runs.filter((run) => keys.has(repoKey(run.repoFullName)));
}

const RUN_TONES: Readonly<Record<RunOverallStatus, RepoRunTone>> = {
  success: "success",
  failure: "failure",
  running: "running",
  partial: "warning",
  cancelled: "warning",
};

/** A run's status as a dot. No run: "none". */
export function runTone(run: Pick<RunGroup, "overallStatus"> | undefined): RepoRunTone {
  if (!run) return "none";
  return RUN_TONES[run.overallStatus] ?? "none";
}

/** The newest run of each repository, on any branch. */
export function latestRunByRepo(runs: ReadonlyArray<RunGroup>): Map<string, RunGroup> {
  const latest = new Map<string, RunGroup>();
  for (const run of runsNewestFirst(runs)) {
    const key = repoKey(run.repoFullName);
    if (!latest.has(key)) latest.set(key, run);
  }
  return latest;
}

export function latestRunFor(latest: ReadonlyMap<string, RunGroup>, repoFullName: string | null): RunGroup | undefined {
  return repoFullName ? latest.get(repoKey(repoFullName)) : undefined;
}

/** Each repository's ALPHACI project id, from the Projects list and the provisioned projects. */
export function repoProjectIds(
  folders: ReadonlyArray<ProjectFolder>,
  projects: ReadonlyArray<ProvisionedProject>,
): Map<string, string> {
  const ids = new Map<string, string>();
  for (const project of projects) {
    if (project.repoFullName) ids.set(repoKey(project.repoFullName), project.id);
  }
  for (const folder of folders) {
    for (const repository of folder.repositories) {
      if (repository.repoFullName && repository.project) {
        ids.set(repoKey(repository.repoFullName), repository.project.id);
      }
    }
  }
  return ids;
}

function repoHref(ids: ReadonlyMap<string, string>, repoFullName: string): string | null {
  const id = ids.get(repoKey(repoFullName));
  return id ? projectPageHref(id) : null;
}

/** Consecutive failures from the newest run (runs newest first). */
export function failureStreak(runs: ReadonlyArray<RunGroup>): number {
  let streak = 0;
  for (const run of runs) {
    if (run.overallStatus !== "failure") break;
    streak += 1;
  }
  return streak;
}

/** Every repository, as runs and the Projects list name it, once; runs first. */
function repositoryNames(runs: ReadonlyArray<RunGroup>, folders: ReadonlyArray<ProjectFolder>): string[] {
  const names = new Map<string, string>();
  const add = (name: string | null) => {
    if (name && !names.has(repoKey(name))) names.set(repoKey(name), name);
  };
  for (const run of runs) add(run.repoFullName);
  for (const folder of folders) {
    for (const repository of folder.repositories) add(repository.repoFullName);
  }
  return [...names.values()];
}

function healthRow(
  repoFullName: string,
  runs: ReadonlyArray<RunGroup>,
  ids: ReadonlyMap<string, string>,
): BranchHealthRow {
  const own = runs.filter((run) => repoKey(run.repoFullName) === repoKey(repoFullName));
  const latestOn = (branch: BranchName) => runTone(own.find((run) => run.branch === branch));
  return {
    repoFullName,
    cells: { dev: latestOn("dev"), uat: latestOn("uat"), main: latestOn("main") },
    failureStreak: failureStreak(own),
    href: repoHref(ids, repoFullName),
  };
}

function failingCells(row: BranchHealthRow): number {
  return HEALTH_BRANCHES.filter((branch) => row.cells[branch] === "failure").length;
}

/**
 * Repository by dev / uat / main: the newest run on each branch, and the
 * repository's failure streak. Failing repositories first.
 */
export function branchHealth(
  runs: ReadonlyArray<RunGroup>,
  folders: ReadonlyArray<ProjectFolder>,
  ids: ReadonlyMap<string, string>,
): BranchHealthRow[] {
  const ordered = runsNewestFirst(runs);
  return repositoryNames(ordered, folders)
    .map((name) => healthRow(name, ordered, ids))
    .sort(
      (a, b) =>
        failingCells(b) - failingCells(a) ||
        b.failureStreak - a.failureStreak ||
        a.repoFullName.localeCompare(b.repoFullName),
    );
}

/** dev / uat / main cells whose newest run failed. */
export function failingBranchCount(rows: ReadonlyArray<BranchHealthRow>): number {
  return rows.reduce((sum, row) => sum + failingCells(row), 0);
}

/* ── UAT automation ─────────────────────────────────────────────────────── */

export function uatRuns(runs: ReadonlyArray<RunGroup>): RunGroup[] {
  return runs.filter((run) => run.branch === "uat");
}

function verifyStage(run: RunGroup) {
  return run.stages.find((stage) => stage.stage === "verify");
}

function testsOf(run: RunGroup): UatAutomationRow["tests"] {
  const tests = verifyStage(run)?.results?.tests;
  if (!tests) return null;
  return { passed: tests.passed, failed: tests.failed, total: tests.total };
}

function uatRow(run: RunGroup, ids: ReadonlyMap<string, string>): UatAutomationRow {
  return {
    repoFullName: run.repoFullName,
    verify: verifyStage(run)?.status ?? "pending",
    tests: testsOf(run),
    startedAt: run.startedAt,
    href: repoHref(ids, run.repoFullName) ?? "/runs",
  };
}

/** The newest uat run of every repository, with its verify stage; failing verify first. */
export function uatAutomationRows(
  runs: ReadonlyArray<RunGroup>,
  ids: ReadonlyMap<string, string>,
): UatAutomationRow[] {
  const rows = [...latestRunByRepo(uatRuns(runs)).values()].map((run) => uatRow(run, ids));
  const failing = rows.filter((row) => row.verify === "failure");
  return [...failing, ...rows.filter((row) => row.verify !== "failure")];
}
