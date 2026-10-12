/* Home's reading of the team QA overview. Pure: no React, no fetch.
 *
 * Counts sum over a Project's live requirements (archived ones are left out,
 * as the Checklists page does). Verification comes from the Project's newest
 * run, so a Project with no run has none: it is "not verified", not zero. */

import { PROJECT_MY_QA_ITEMS_HASH } from "@/features/checklists";

import {
  deliveryProjectHref,
  projectStudioHref,
  type HomeLinkContext,
} from "./home-persona-rules";
import type {
  LegacyRunRow,
  OpenRunRow,
  ProductionView,
  ReadyForProductionRow,
  RetestRow,
  ReturnedRow,
  VerificationRow,
} from "./home-persona-types";
import type {
  TeamQaDefectCounts,
  TeamQaLatestRun,
  TeamQaOverview,
  TeamQaProject,
  TeamQaPromotion,
  TeamQaRequirementSummary,
  TeamQaVerificationCounts,
} from "./home-types";

type QaRunStatus = VerificationRow["status"];
type QaVerdict = ReadyForProductionRow["verdict"];

const ZERO_VERIFICATION: TeamQaVerificationCounts = {
  pending: 0,
  passed: 0,
  failed: 0,
  blocked: 0,
  returned_to_dev: 0,
};

const ZERO_DEFECTS: TeamQaDefectCounts = { blocker: 0, major: 0, minor: 0, unrated: 0 };

export function liveRequirements(project: TeamQaProject): TeamQaRequirementSummary[] {
  return project.requirements.filter((requirement) => requirement.archivedAt === null);
}

function addVerification(
  a: TeamQaVerificationCounts,
  b: TeamQaVerificationCounts,
): TeamQaVerificationCounts {
  return {
    pending: a.pending + b.pending,
    passed: a.passed + b.passed,
    failed: a.failed + b.failed,
    blocked: a.blocked + b.blocked,
    returned_to_dev: a.returned_to_dev + b.returned_to_dev,
  };
}

/** The Project's Verification on its newest run, over live requirements; null with no run. */
export function verificationTotals(project: TeamQaProject): TeamQaVerificationCounts | null {
  const counted = liveRequirements(project)
    .map((requirement) => requirement.verification)
    .filter((counts): counts is TeamQaVerificationCounts => counts !== null);
  if (counted.length === 0) return null;
  return counted.reduce(addVerification, ZERO_VERIFICATION);
}

export function returnedCount(project: TeamQaProject): number {
  return verificationTotals(project)?.returned_to_dev ?? 0;
}

export function pendingCount(project: TeamQaProject): number {
  return verificationTotals(project)?.pending ?? 0;
}

export function failedOrBlockedCount(project: TeamQaProject): number {
  const totals = verificationTotals(project) ?? ZERO_VERIFICATION;
  return totals.failed + totals.blocked;
}

/** Items a Developer has In progress, over live requirements. */
export function inProgressCount(project: TeamQaProject): number {
  return liveRequirements(project).reduce((sum, requirement) => sum + requirement.progressCounts.in_progress, 0);
}

/** The newest run's state: `latestRun` when the server sent it, else any requirement's `latestRunStatus`. */
export function projectRunStatus(project: TeamQaProject): QaRunStatus | null {
  if (project.latestRun) return project.latestRun.status;
  const withRun = project.requirements.find((requirement) => requirement.latestRunStatus !== null);
  return withRun ? withRun.latestRunStatus : null;
}

export function sumOver(projects: ReadonlyArray<TeamQaProject>, pick: (project: TeamQaProject) => number): number {
  return projects.reduce((sum, project) => sum + pick(project), 0);
}

/** Ready for re-test over these Projects; null when the server sent no counts at all. */
export function readyForRetestTotal(
  overview: TeamQaOverview | null,
  projects: ReadonlyArray<TeamQaProject>,
): number | null {
  if (!overview?.supports.counts) return null;
  return sumOver(projects, (project) => project.counts.readyForQa ?? 0);
}

function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name);
}

/* ── Developer: Returned by QA ──────────────────────────────────────────── */

/**
 * One row per Project with items returned to development, most first. The
 * row opens the Project page on its "My QA items" tab: the team works one
 * list per Project, so this is "returned in my Projects", not "to me".
 */
export function returnedRows(projects: ReadonlyArray<TeamQaProject>, links: HomeLinkContext): ReturnedRow[] {
  return projects
    .map((project) => ({
      deliveryProjectId: project.deliveryProject.id,
      name: project.deliveryProject.name,
      returned: returnedCount(project),
      defects: project.counts.openDefects,
      href: `${deliveryProjectHref(links.groupId, project.deliveryProject.id)}#${PROJECT_MY_QA_ITEMS_HASH}`,
    }))
    .filter((row) => row.returned > 0)
    .sort((a, b) => b.returned - a.returned || byName(a, b));
}

/* ── QA Team ────────────────────────────────────────────────────────────── */

const RUN_STATUS_ORDER: Readonly<Record<QaRunStatus, number>> = { open: 0, signed_off: 1 };

/** Every Project with a run: open runs first, then signed off; each opens QA Studio. */
export function verificationRows(projects: ReadonlyArray<TeamQaProject>, links: HomeLinkContext): VerificationRow[] {
  const rows: VerificationRow[] = [];
  for (const project of projects) {
    const status = projectRunStatus(project);
    if (!status) continue;
    rows.push({
      deliveryProjectId: project.deliveryProject.id,
      name: project.deliveryProject.name,
      status,
      verdict: project.latestRun?.verdict ?? null,
      counts: verificationTotals(project) ?? ZERO_VERIFICATION,
      href: projectStudioHref(links, project.deliveryProject.id, "qa"),
    });
  }
  return rows.sort((a, b) => RUN_STATUS_ORDER[a.status] - RUN_STATUS_ORDER[b.status] || byName(a, b));
}

/** Projects with items ready for a re-test; null when the server sent no counts (an older backend). */
export function retestRows(
  overview: TeamQaOverview | null,
  projects: ReadonlyArray<TeamQaProject>,
  links: HomeLinkContext,
): RetestRow[] | null {
  if (!overview?.supports.counts) return null;
  return projects
    .map((project) => ({
      deliveryProjectId: project.deliveryProject.id,
      name: project.deliveryProject.name,
      ready: project.counts.readyForQa ?? 0,
      href: projectStudioHref(links, project.deliveryProject.id, "qa"),
    }))
    .filter((row) => row.ready > 0)
    .sort((a, b) => b.ready - a.ready || byName(a, b));
}

function addDefects(a: TeamQaDefectCounts, b: TeamQaDefectCounts): TeamQaDefectCounts {
  return {
    blocker: a.blocker + b.blocker,
    major: a.major + b.major,
    minor: a.minor + b.minor,
    unrated: a.unrated + b.unrated,
  };
}

/** Open defects by severity over these Projects; null when the server sent none. */
export function defectTotals(projects: ReadonlyArray<TeamQaProject>): TeamQaDefectCounts | null {
  const counted = projects
    .map((project) => project.counts.openDefects)
    .filter((counts): counts is TeamQaDefectCounts => counts !== null);
  if (counted.length === 0) return null;
  return counted.reduce(addDefects, ZERO_DEFECTS);
}

/* ── Product owner: Ready for production ────────────────────────────────── */

const SHIPPABLE_VERDICTS: ReadonlySet<QaVerdict> = new Set<QaVerdict>(["APPROVED", "CONDITIONAL"]);

interface Shippable {
  run: TeamQaLatestRun;
  verdict: QaVerdict;
  promotion: TeamQaPromotion;
}

function shippable(project: TeamQaProject): Shippable | null {
  const { latestRun: run, promotion } = project;
  if (run?.status !== "signed_off" || !run.verdict || !promotion) return null;
  if (!SHIPPABLE_VERDICTS.has(run.verdict)) return null;
  if (promotion.mergedRepositories >= promotion.totalRepositories) return null;
  return { run, verdict: run.verdict, promotion };
}

/**
 * Signed off as Approved or Conditional, and not every repository merged to
 * main yet. A Project whose promotion the server did not report is left out:
 * nothing says it still has something to promote.
 */
export function isReadyForProduction(project: TeamQaProject): boolean {
  return shippable(project) !== null;
}

function readyRows(projects: ReadonlyArray<TeamQaProject>, links: HomeLinkContext): ReadyForProductionRow[] {
  const rows: ReadyForProductionRow[] = [];
  for (const project of projects) {
    const ready = shippable(project);
    if (!ready) continue;
    rows.push({
      deliveryProjectId: project.deliveryProject.id,
      name: project.deliveryProject.name,
      verdict: ready.verdict,
      signedOffBy: ready.run.signedOffBy,
      signedOffAt: ready.run.signedOffAt,
      mergedRepositories: ready.promotion.mergedRepositories,
      totalRepositories: ready.promotion.totalRepositories,
      href: projectStudioHref(links, project.deliveryProject.id, "po"),
    });
  }
  return rows.sort(byName);
}

function openRunRow(project: TeamQaProject, links: HomeLinkContext): OpenRunRow {
  const totals = verificationTotals(project) ?? ZERO_VERIFICATION;
  return {
    deliveryProjectId: project.deliveryProject.id,
    name: project.deliveryProject.name,
    failed: totals.failed,
    blocked: totals.blocked,
    href: projectStudioHref(links, project.deliveryProject.id, "po"),
  };
}

function legacyRows(projects: ReadonlyArray<TeamQaProject>, links: HomeLinkContext): LegacyRunRow[] {
  const rows: LegacyRunRow[] = [];
  for (const project of projects) {
    const status = projectRunStatus(project);
    if (!status) continue;
    rows.push({
      deliveryProjectId: project.deliveryProject.id,
      name: project.deliveryProject.name,
      status,
      href: projectStudioHref(links, project.deliveryProject.id, "po"),
    });
  }
  return rows.sort((a, b) => RUN_STATUS_ORDER[b.status] - RUN_STATUS_ORDER[a.status] || byName(a, b));
}

/**
 * What can ship: the Projects ready for production, and quieter, the ones
 * still being verified. A backend that sent no `latestRun` gives only each
 * Project's open or signed-off state.
 */
export function productionView(overview: TeamQaOverview | null, links: HomeLinkContext): ProductionView {
  if (!overview) return { mode: "unavailable", ready: [], open: [], legacy: [] };
  const projects = overview.projects;
  if (!overview.supports.latestRun) {
    return { mode: "legacy", ready: [], open: [], legacy: legacyRows(projects, links) };
  }
  return {
    mode: "full",
    ready: readyRows(projects, links),
    open: projects
      .filter((project) => project.latestRun?.status === "open")
      .map((project) => openRunRow(project, links))
      .sort((a, b) => b.failed + b.blocked - (a.failed + a.blocked) || byName(a, b)),
    legacy: [],
  };
}
