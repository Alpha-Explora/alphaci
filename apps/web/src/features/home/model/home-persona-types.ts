/* Types for Home by role. Pure: no React, no fetch, no Next.
 *
 * Home shows each role its first job: a Developer what to fix next, the QA
 * Team what to verify next, a Product owner (and an admin) what can ship and
 * what is stuck. Anyone else, and the QA Team when the QA capability is off,
 * keeps the team dashboard ("team"). */

import type { AppRole, RunGroup, StageStatus } from "@/shared/api/contracts";
import type {
  QaRunStatus,
  QaVerdict,
  TeamQaDefectCounts,
  TeamQaVerificationCounts,
} from "@/features/checklists";

import type { RunStats, SectionStatus } from "./home-types";

export type HomePersona = "team" | "developer" | "qa" | "product-owner";

export type HomeMetricId =
  | "scope-projects"
  | "repositories"
  | "returned"
  | "in-progress"
  | "running"
  | "failing-runs"
  | "success-rate"
  | "in-verification"
  | "pending-items"
  | "failed-or-blocked"
  | "ready-for-retest"
  | "uat-pass-rate"
  | "projects"
  | "awaiting-promotion"
  | "need-attention"
  | "failing-branches";

export type HomeBlockId =
  | "returned-by-qa"
  | "scoped-runs"
  | "my-work"
  | "quality"
  | "projects-in-verification"
  | "uat-automation"
  | "ready-for-retest"
  | "defects"
  | "ready-for-production"
  | "branch-health"
  | "needs-attention"
  | "team-runs"
  | "team-projects";

export type HomeShortcutId = "add-repository" | "create-project" | "projects" | "runs";

/** What a layout reads. Anything false is never requested. */
export interface HomeDataNeeds {
  /** Workflow history: the team dashboard's metric and the get-started journey. */
  history: boolean;
  /** The groups, systems, Projects and repositories walk, plus Activity: the team dashboard only. */
  workspace: boolean;
  /** The team's Projects with their repositories (GET /groups/:id/project-folders). */
  folders: boolean;
  /** The team's QA overview (capability-gated). */
  qaOverview: boolean;
}

/**
 * One role's Home: at most 5 metrics, 2 main blocks and 2 side blocks, so it
 * still fits one screen. The team layout renders today's dashboard as is and
 * lists no blocks of its own.
 */
export interface HomeLayout {
  persona: HomePersona;
  /** Whether this layout carries the QA-backed blocks. */
  qa: boolean;
  metrics: readonly HomeMetricId[];
  main: readonly HomeBlockId[];
  side: readonly HomeBlockId[];
  shortcuts: readonly HomeShortcutId[];
  needs: HomeDataNeeds;
}

export interface HomeShortcut {
  id: HomeShortcutId;
  /** Lower-case key. */
  key: string;
  label: string;
}

/** The sections a block can wait on. */
export type HomeSectionKey = "projects" | "runs" | "folders" | "qaOverview";

export type HomeSectionStates = Record<HomeSectionKey, { status: SectionStatus; error: string | null }>;

/** What a block renders while its data is in flight or after it failed. */
export interface HomeBlockState {
  loading: boolean;
  /** User-safe. Only the block's own source can fail it. */
  error: string | null;
}

/**
 * Whose Projects a block covers:
 *   mine      the Projects the viewer is a member of, in their role;
 *   fallback  the viewer is a member of none, so the whole team, said so;
 *   team      membership is not known (QA off, or not read) or not asked for.
 */
export type HomeScopeMode = "mine" | "fallback" | "team";

export interface HomeScope {
  mode: HomeScopeMode;
  /** Delivery-project ids in scope. */
  projectIds: readonly string[];
}

export interface HomeMetric {
  id: HomeMetricId;
  label: string;
  /** Null when it is not known; shown as a dash. */
  value: number | null;
  suffix: string;
  href: string | null;
}

/** A role badge for the Home header. */
export interface HomeRoleBadge {
  role: AppRole;
  label: string;
}

/* ── Block rows ─────────────────────────────────────────────────────────── */

export type RepoRunTone = "success" | "failure" | "running" | "warning" | "none";

export interface ReturnedRow {
  deliveryProjectId: string;
  name: string;
  returned: number;
  /** Open defects by severity, when the server sent them. */
  defects: TeamQaDefectCounts | null;
  href: string;
}

export interface MyWorkRepository {
  repositoryId: string;
  name: string;
  /** The ALPHACI project page, or null when the repository is not linked to one. */
  href: string | null;
  tone: RepoRunTone;
  /** The latest run's branch, when there is one. */
  branch: string | null;
}

export interface MyWorkProject {
  deliveryProjectId: string;
  name: string;
  href: string;
  repositories: MyWorkRepository[];
}

export interface VerificationRow {
  deliveryProjectId: string;
  name: string;
  status: QaRunStatus;
  verdict: QaVerdict | null;
  counts: TeamQaVerificationCounts;
  href: string;
}

export interface RetestRow {
  deliveryProjectId: string;
  name: string;
  ready: number;
  href: string;
}

export interface UatAutomationRow {
  repoFullName: string;
  verify: StageStatus;
  tests: { passed: number; failed: number; total: number } | null;
  startedAt: string;
  href: string;
}

export interface ReadyForProductionRow {
  deliveryProjectId: string;
  name: string;
  verdict: QaVerdict;
  signedOffBy: string | null;
  signedOffAt: string | null;
  mergedRepositories: number;
  totalRepositories: number;
  href: string;
}

export interface OpenRunRow {
  deliveryProjectId: string;
  name: string;
  failed: number;
  blocked: number;
  href: string;
}

/** A Project's run state when the server sent only `latestRunStatus` (an older backend). */
export interface LegacyRunRow {
  deliveryProjectId: string;
  name: string;
  status: QaRunStatus;
  href: string;
}

export interface ProductionView {
  /** full: latestRun fields present; legacy: only latestRunStatus; unavailable: no overview. */
  mode: "full" | "legacy" | "unavailable";
  ready: ReadyForProductionRow[];
  open: OpenRunRow[];
  legacy: LegacyRunRow[];
}

export type BranchName = "dev" | "uat" | "main";

export interface BranchHealthRow {
  repoFullName: string;
  cells: Record<BranchName, RepoRunTone>;
  /** Consecutive failures from the repository's newest run, on any branch. */
  failureStreak: number;
  href: string | null;
}

export interface AttentionRow {
  deliveryProjectId: string;
  name: string;
  reasons: string[];
  href: string;
}

/** Everything a role's Home renders, derived in one place from what was read. */
export interface PersonaDashboard {
  scope: HomeScope;
  /** Said when the viewer is a member of no Project and the blocks show the team instead. */
  fallbackLine: string | null;
  metrics: HomeMetric[];
  /** Runs in scope (failures first for a Developer). */
  runs: RunGroup[];
  runStats: RunStats;
  returned: ReturnedRow[];
  myWork: MyWorkProject[];
  addRepositoryHref: string | null;
  verification: VerificationRow[];
  uatAutomation: UatAutomationRow[];
  /** Null when the server sent no ready-for-QA counts. */
  retest: RetestRow[] | null;
  /** Null when the server sent no defect counts. */
  defects: TeamQaDefectCounts | null;
  production: ProductionView;
  branchHealth: BranchHealthRow[];
  needsAttention: AttentionRow[];
  createProjectHref: string | null;
}
