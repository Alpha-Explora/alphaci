/* A role's Home, derived in one place from what Home read. Pure: no React,
 * no fetch. The view-model calls buildPersonaDashboard; the views render
 * what it returns. */

import { createRepositoryHref } from "@/features/teams/project-folders";

import {
  failedOrBlockedCount,
  inProgressCount,
  pendingCount,
  productionView,
  projectRunStatus,
  readyForRetestTotal,
  retestRows,
  returnedCount,
  returnedRows,
  sumOver,
  verificationRows,
  defectTotals,
} from "./home-qa-rules";
import {
  foldersInScope,
  homeLinkContext,
  homeScopeFor,
  qaProjectsInScope,
  scopeFallbackLine,
} from "./home-persona-rules";
import type {
  HomeLayout,
  HomeMetric,
  HomeMetricId,
  HomeScope,
  PersonaDashboard,
  ProductionView,
} from "./home-persona-types";
import { computeRunStats, newProjectHref } from "./home-rules";
import {
  branchHealth,
  failingBranchCount,
  latestRunByRepo,
  repoProjectIds,
  runsFailuresFirst,
  runsInScope,
  uatAutomationRows,
  uatRuns,
} from "./home-run-rules";
import type {
  ProjectFolder,
  ProjectFoldersSnapshot,
  ProvisionedProject,
  RunGroup,
  RunStats,
  TeamQaOverview,
  TeamQaProject,
} from "./home-types";
import { myWorkProjects, needsAttentionRows } from "./home-work-rules";

const PROJECTS_HREF = "/workflows?tab=current";
const RUNS_HREF = "/runs";

/* ── Metrics ────────────────────────────────────────────────────────────── */

/** What the metric rail reads, already narrowed to the role's scope. */
export interface HomeFacts {
  scope: HomeScope;
  scopedFolders: ReadonlyArray<ProjectFolder>;
  overview: TeamQaOverview | null;
  scopedQa: ReadonlyArray<TeamQaProject>;
  runStats: RunStats;
  uatStats: RunStats;
  production: ProductionView;
  attention: number;
  failingBranches: number;
}

type MetricValue = Omit<HomeMetric, "id">;

function metric(label: string, value: number | null, href: string | null = null, suffix = ""): MetricValue {
  return { label, value, suffix, href };
}

/** A sum over the scoped Projects of the overview; null when it was not read. */
function qaSum(facts: HomeFacts, pick: (project: TeamQaProject) => number): number | null {
  return facts.overview ? sumOver(facts.scopedQa, pick) : null;
}

function repositoryCount(folders: ReadonlyArray<ProjectFolder>): number {
  return folders.reduce((sum, folder) => sum + folder.repositories.length, 0);
}

const isOpen = (project: TeamQaProject) => (projectRunStatus(project) === "open" ? 1 : 0);

const METRICS: Readonly<Record<HomeMetricId, (facts: HomeFacts) => MetricValue>> = {
  "scope-projects": (f) =>
    metric(f.scope.mode === "mine" ? "My Projects" : "Team Projects", f.scope.projectIds.length, PROJECTS_HREF),
  repositories: (f) => metric("Repositories", repositoryCount(f.scopedFolders), PROJECTS_HREF),
  returned: (f) => metric("Returned by QA", qaSum(f, returnedCount)),
  "in-progress": (f) => metric("In progress", qaSum(f, inProgressCount)),
  running: (f) => metric("Running", f.runStats.running, RUNS_HREF),
  "failing-runs": (f) => metric("Failing runs", f.runStats.failures, RUNS_HREF),
  "success-rate": (f) => metric("Success rate", f.runStats.successRate, RUNS_HREF, "%"),
  "in-verification": (f) => metric("In verification", qaSum(f, isOpen)),
  "pending-items": (f) => metric("Pending items", qaSum(f, pendingCount)),
  "failed-or-blocked": (f) => metric("Failed or blocked", qaSum(f, failedOrBlockedCount)),
  "ready-for-retest": (f) => metric("Ready for re-test", readyForRetestTotal(f.overview, f.scopedQa)),
  "uat-pass-rate": (f) => metric("UAT pass rate", f.uatStats.successRate, RUNS_HREF, "%"),
  projects: (f) => metric("Projects", f.scope.projectIds.length, PROJECTS_HREF),
  "awaiting-promotion": (f) =>
    metric("Awaiting promotion", f.production.mode === "full" ? f.production.ready.length : null),
  "need-attention": (f) => metric("Need attention", f.attention),
  "failing-branches": (f) => metric("Failing branches", f.failingBranches, RUNS_HREF),
};

export function homeMetrics(ids: ReadonlyArray<HomeMetricId>, facts: HomeFacts): HomeMetric[] {
  return ids.map((id) => ({ id, ...METRICS[id](facts) }));
}

/* ── Actions on blocks ──────────────────────────────────────────────────── */

/**
 * "Add repository" on My work: the wizard scoped to the team, and to the one
 * Project when there is exactly one in scope. Hidden when the server says the
 * caller may not create a repository.
 */
export function addRepositoryHref(
  snapshot: ProjectFoldersSnapshot | null,
  scope: HomeScope,
  groupId: string | null,
): string | null {
  if (!groupId || snapshot?.canCreateRepository === false) return null;
  const only = scope.projectIds.length === 1 ? scope.projectIds[0] : undefined;
  return createRepositoryHref(groupId, only);
}

/** "Create project" on Projects needing attention, unless the server says no. */
export function createProjectHref(snapshot: ProjectFoldersSnapshot | null, groupId: string | null): string | null {
  if (snapshot?.canCreateProject === false) return null;
  return newProjectHref(groupId);
}

/* ── The builder ────────────────────────────────────────────────────────── */

export interface PersonaDashboardInput {
  layout: HomeLayout;
  groupId: string | null;
  /** Null until read, or when it could not be. */
  folders: ProjectFoldersSnapshot | null;
  overview: TeamQaOverview | null;
  /** The team's runs, as the server ordered them (newest first). */
  teamRuns: ReadonlyArray<RunGroup>;
  projects: ReadonlyArray<ProvisionedProject>;
}

export function buildPersonaDashboard(input: PersonaDashboardInput): PersonaDashboard {
  const { layout, overview } = input;
  const folders = input.folders?.folders ?? [];
  const links = homeLinkContext(input.groupId ?? "", folders);
  const scope = homeScopeFor({ persona: layout.persona, folders, overview });
  const scopedFolders = foldersInScope(folders, scope);
  const scopedQa = qaProjectsInScope(overview, scope);
  const scopedRuns = runsInScope(input.teamRuns, scope, scopedFolders);
  const ids = repoProjectIds(folders, input.projects);
  const health = branchHealth(scopedRuns, scopedFolders, ids);
  const production = productionView(overview, links);
  const needsAttention = needsAttentionRows(folders, overview, layout.qa, links);
  const runStats = computeRunStats(scopedRuns);
  const facts: HomeFacts = {
    scope,
    scopedFolders,
    overview,
    scopedQa,
    runStats,
    uatStats: computeRunStats(uatRuns(input.teamRuns)),
    production,
    attention: needsAttention.length,
    failingBranches: failingBranchCount(health),
  };
  return {
    scope,
    fallbackLine: scopeFallbackLine(layout.persona, scope),
    metrics: homeMetrics(layout.metrics, facts),
    runs: layout.persona === "developer" ? runsFailuresFirst(scopedRuns) : scopedRuns,
    runStats,
    returned: returnedRows(scopedQa, links),
    myWork: myWorkProjects(scopedFolders, latestRunByRepo(scopedRuns), links),
    addRepositoryHref: addRepositoryHref(input.folders, scope, input.groupId),
    verification: verificationRows(scopedQa, links),
    uatAutomation: uatAutomationRows(input.teamRuns, ids),
    retest: retestRows(overview, scopedQa, links),
    defects: defectTotals(scopedQa),
    production,
    branchHealth: health,
    needsAttention,
    createProjectHref: createProjectHref(input.folders, input.groupId),
    runProjectIds: ids,
  };
}
