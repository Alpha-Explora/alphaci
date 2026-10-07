/* Pure rules for the studio column's Playwright tab: which repositories it
 * lists, what its tab label says, which empty state shows, the requirement ↔
 * test list, and the copy for "Run Playwright" on a Project run. No React,
 * no fetch.
 *
 * Results are information for the tester. Nothing here changes or recommends
 * an item's recorded status: sign-off stays manual. */

import type { QaAutomatedItemResult, QaAutomatedStatus, QaRunAutomationResult, QaStageResult, QaTestFailure } from "./qa-automation-types";
import {
  automatedBadgeLabel,
  automatedStatusTone,
  hasStageResults,
  normalizeAutomatedResult,
  normalizeRunAutomation,
  verifySettledSince,
} from "./qa-automation-rules";
import { repoShortName } from "./project-run-rules";
import type { ProjectDispatchResult, ProjectQaRun, RepositoryAutomation } from "./project-run-types";
import type { QaTone } from "./qa-run-rules";
import type { QaRun } from "./qa-run-types";

/* ── The tabs ───────────────────────────────────────────────────────────── */

export type StudioColumnTab = "checklist" | "playwright";

export const STUDIO_COLUMN_TABS: ReadonlyArray<StudioColumnTab> = ["checklist", "playwright"];

/** Per viewer, per studio, in this browser: the column tab they last chose. */
export function studioColumnTabKey(studio: "qa" | "po"): string {
  return `alphaci.${studio}-studio.column-tab`;
}

/** What storage holds, as a tab: anything unknown opens the Checklist. */
export function resolveStudioColumnTab(stored: string | null): StudioColumnTab {
  return stored === "playwright" ? "playwright" : "checklist";
}

/* ── What the Playwright tab lists ──────────────────────────────────────── */

/** One repository's results (or the server's merge of several). */
export interface PlaywrightRepository {
  key: string;
  /** The repository's ALPHACI project id; null for a merged result. */
  projectId: string | null;
  /** "storefront-web"; "All repositories" for a merged result. */
  name: string;
  repoFullName: string | null;
  /** The repositories a merged result covers; empty for one repository. */
  covers: string[];
  branch: string;
  /** The commit the results are for (the head the run captured). */
  commitSha: string | null;
  automation: QaRunAutomationResult;
  /** The repositories whose visual checks and browser tests show under it. */
  checks: RepositoryRef[];
}

/** A repository the host page can draw its own checks for. */
export interface RepositoryRef {
  projectId: string;
  repoFullName: string;
}

/** One run item with an automated result. */
export interface PlaywrightItemRow {
  id: string;
  title: string;
  /** The requirement it belongs to, on a Project run. */
  group: string | null;
  /** The matched spec, else the item's own test id. */
  test: string | null;
  status: QaAutomatedStatus;
  label: string;
  tone: QaTone;
  inferred: boolean;
  failure: QaTestFailure | null;
}

export interface PlaywrightResults {
  /** False when the server sent no automated results at all (an older backend). */
  supported: boolean;
  repositories: PlaywrightRepository[];
  items: PlaywrightItemRow[];
}

/** The branch every Project run verifies. */
export const PROJECT_RUN_BRANCH = "uat";

export const MERGED_RESULTS_NAME = "All repositories";

const STATUS_ORDER: Record<QaAutomatedStatus, number> = { failed: 0, unknown: 1, not_run: 2, passed: 3 };

interface ItemSource {
  id: string;
  title: string;
  group: string | null;
  testIdentifier: string | null;
  result: QaAutomatedItemResult | null;
}

/** Failed first, then what CI could not tell, then not run, then passed; run order within each. */
export function playwrightItemRows(items: ReadonlyArray<ItemSource>): PlaywrightItemRow[] {
  return items
    .flatMap((item) => (item.result ? [{ item, result: item.result }] : []))
    .map(({ item, result }, index) => ({
      index,
      row: {
        id: item.id,
        title: item.title,
        group: item.group,
        test: result.matchedSpec ?? item.testIdentifier,
        status: result.status,
        label: automatedBadgeLabel(result.status, result.inferred),
        tone: automatedStatusTone(result.status),
        inferred: result.status === "passed" && result.inferred,
        failure: result.status === "failed" ? result.failure : null,
      },
    }))
    .sort((a, b) => STATUS_ORDER[a.row.status] - STATUS_ORDER[b.row.status] || a.index - b.index)
    .map(({ row }) => row);
}

function capturedHead(run: ProjectQaRun, projectId: string): string | null {
  return run.repositories.find((head) => head.projectId === projectId)?.runSha ?? null;
}

function perRepository(run: ProjectQaRun, entry: RepositoryAutomation): PlaywrightRepository {
  return {
    key: entry.projectId,
    projectId: entry.projectId,
    name: repoShortName(entry.repoFullName),
    repoFullName: entry.repoFullName,
    covers: [],
    branch: PROJECT_RUN_BRANCH,
    commitSha: capturedHead(run, entry.projectId),
    automation: entry.automation,
    checks: [{ projectId: entry.projectId, repoFullName: entry.repoFullName }],
  };
}

function merged(run: ProjectQaRun, automation: QaRunAutomationResult): PlaywrightRepository {
  return {
    key: "merged",
    projectId: null,
    name: MERGED_RESULTS_NAME,
    repoFullName: null,
    covers: run.repositories.map((head) => repoShortName(head.repoFullName)),
    branch: PROJECT_RUN_BRANCH,
    commitSha: null,
    automation,
    checks: run.repositories.map((head) => ({ projectId: head.projectId, repoFullName: head.repoFullName })),
  };
}

/**
 * A Project run's results: one entry per covered repository when the server
 * sends the breakdown, else its merged result naming what it covers.
 */
export function projectPlaywrightResults(run: ProjectQaRun): PlaywrightResults {
  const byRepository = run.automationByRepository ?? [];
  let repositories: PlaywrightRepository[] = [];
  if (byRepository.length > 0) repositories = byRepository.map((entry) => perRepository(run, entry));
  else if (run.automation) repositories = [merged(run, run.automation)];
  return {
    supported: run.automation !== null || run.automationByRepository !== null,
    repositories,
    items: playwrightItemRows(
      run.items.map((item) => ({
        id: item.id,
        title: item.title,
        group: item.requirementName,
        testIdentifier: item.testIdentifier,
        result: item.automated,
      })),
    ),
  };
}

/** A repository run's results: one repository, on the run's branch and commit. */
export function repositoryPlaywrightResults(
  run: QaRun,
  repository: { projectId: string; repoFullName: string | null },
): PlaywrightResults {
  const name = repository.repoFullName ? repoShortName(repository.repoFullName) : "This repository";
  return {
    supported: run.automation !== undefined,
    repositories: [
      {
        key: repository.projectId,
        projectId: repository.projectId,
        name,
        repoFullName: repository.repoFullName,
        covers: [],
        branch: run.branch,
        commitSha: run.commitSha,
        automation: normalizeRunAutomation(run.automation),
        checks: [{ projectId: repository.projectId, repoFullName: repository.repoFullName ?? name }],
      },
    ],
    items: playwrightItemRows(
      run.items.map((item) => ({
        id: item.id,
        title: item.title,
        group: null,
        testIdentifier: item.testIdentifier,
        result: normalizeAutomatedResult(item.automated),
      })),
    ),
  };
}

/* ── States and copy ────────────────────────────────────────────────────── */

/**
 * `loading` until the run is known; `no-run` without one (results attach to
 * a run); `unsupported` on a server that reports none; else `results`
 * (where each repository may still say it has not run).
 */
export type PlaywrightPanelState = "loading" | "no-run" | "unsupported" | "results";

export function playwrightPanelState(input: {
  ready: boolean;
  results: PlaywrightResults | null;
}): PlaywrightPanelState {
  if (!input.ready) return "loading";
  if (!input.results) return "no-run";
  return input.results.supported ? "results" : "unsupported";
}

export const UNSUPPORTED_TEXT = "This server doesn't report automated results.";

export const NO_RUN_TITLE = "No QA run yet";

export function noRunText(project: boolean): string {
  return project
    ? "Playwright results attach to the Project's QA run. Once it starts (in the Checklist tab), each repository's results on uat appear here."
    : "Playwright results attach to a QA run. Once one starts (in the Checklist tab), its results appear here.";
}

/** "Playwright hasn't run on uat yet". */
export function notRunText(branch: string): string {
  return `Playwright hasn't run on ${branch} yet`;
}

export function repositoryHasResults(repository: Pick<PlaywrightRepository, "automation">): boolean {
  return hasStageResults(repository.automation);
}

/** "storefront-web", "storefront-web and orders-api", "a, b and c". */
export function namesList(names: ReadonlyArray<string>): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Under a merged result: which repositories it stands for. */
export function mergedNote(covers: ReadonlyArray<string>): string | null {
  if (covers.length === 0) return null;
  return `Combined for ${namesList(covers)}: the first report of each stage.`;
}

/* ── The tab label ──────────────────────────────────────────────────────── */

export type PlaywrightTabTone = "running" | "failed" | "passed" | "none";

export interface PlaywrightTabStatus {
  /** After "Playwright · ": "22/24", "failing", "running", "passed"; null says nothing. */
  text: string | null;
  /** The same for a screen reader. */
  spoken: string | null;
  tone: PlaywrightTabTone;
}

const NO_STATUS: PlaywrightTabStatus = { text: null, spoken: null, tone: "none" };

function verifyStages(results: PlaywrightResults | null): QaStageResult[] {
  return (results?.repositories ?? [])
    .map((repository) => repository.automation.verify)
    .filter((stage): stage is QaStageResult => stage !== null);
}

/** Summed counts, only when every reported stage sent both numbers. */
function summedCounts(stages: ReadonlyArray<QaStageResult>): { passed: number; total: number } | null {
  let passed = 0;
  let total = 0;
  for (const stage of stages) {
    const tests = stage.tests;
    if (!tests || tests.passed === null || tests.total === null) return null;
    passed += tests.passed;
    total += tests.total;
  }
  return { passed, total };
}

function countsStatus(counts: { passed: number; total: number }, failing: boolean): PlaywrightTabStatus {
  return {
    text: `${String(counts.passed)}/${String(counts.total)}`,
    spoken: `${String(counts.passed)} of ${String(counts.total)} browser tests passed`,
    tone: failing || counts.passed < counts.total ? "failed" : "passed",
  };
}

/**
 * What the Playwright tab's label carries, from the verify (browser) stage of
 * every listed repository: running wins (results are on the way), then the
 * summed counts, then a bare verdict. Nothing when nothing reported.
 */
export function playwrightTabStatus(results: PlaywrightResults | null): PlaywrightTabStatus {
  const stages = verifyStages(results);
  if (stages.length === 0) return NO_STATUS;
  if (stages.some((stage) => stage.status === "running")) {
    return { text: "running", spoken: "Playwright is running", tone: "running" };
  }
  const failing = stages.some((stage) => stage.status === "failure");
  const counts = summedCounts(stages);
  if (counts && counts.total > 0) return countsStatus(counts, failing);
  if (failing) return { text: "failing", spoken: "Playwright tests are failing", tone: "failed" };
  if (stages.some((stage) => stage.status === "success")) {
    return { text: "passed", spoken: "Playwright tests passed", tone: "passed" };
  }
  return NO_STATUS;
}

/* ── Run Playwright on a Project run ────────────────────────────────────── */

/** "Playwright started on uat in storefront-web and orders-api. …" */
export function projectDispatchConfirmation(result: ProjectDispatchResult): string | null {
  if (result.dispatched.length === 0) return null;
  const names = namesList(result.dispatched.map((entry) => repoShortName(entry.repoFullName)));
  const ref = result.dispatched[0].ref ?? PROJECT_RUN_BRANCH;
  return `Playwright started on ${ref} in ${names}. Results appear here when the runs report.`;
}

/**
 * What the tester should know besides: a repository whose uat moved past
 * the head this run captured (its results attach to the newer commit, so not
 * to this run), and each repository it could not start in. Null when none.
 */
export function projectDispatchWarning(result: ProjectDispatchResult): string | null {
  const moved = result.dispatched
    .filter((entry) => entry.targetsRunCommit === false)
    .map((entry) => repoShortName(entry.repoFullName));
  const parts: string[] = [];
  if (moved.length > 0) {
    parts.push(
      `uat moved in ${namesList(moved)} since this run started — those results attach to the newer commit, not this run. Start a new Project run to verify it.`,
    );
  }
  for (const failure of result.failed) parts.push(`Not started in ${repoShortName(failure.repoFullName)}: ${failure.message}`);
  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Whether every repository Playwright started in has reported its verify
 * stage since `sinceMs`, so polling can stop. Without a per-repository
 * breakdown, the merged verify stage decides.
 */
export function projectVerifySettledSince(run: ProjectQaRun, projectIds: ReadonlyArray<string>, sinceMs: number): boolean {
  const byRepository = run.automationByRepository ?? [];
  if (byRepository.length === 0) return run.automation ? verifySettledSince(run.automation, sinceMs) : false;
  const watched = byRepository.filter((entry) => projectIds.length === 0 || projectIds.includes(entry.projectId));
  return watched.length > 0 && watched.every((entry) => verifySettledSince(entry.automation, sinceMs));
}
