/* What each role's Home lays out and reads. Pure: no React, no fetch.
 *
 * One rule, one table. A layout is at most 5 metrics, 2 main blocks and 2
 * side blocks, so Home still fits one screen at 1024x720 and up. When the QA
 * capability is off, a Developer and a Product owner keep their Home with
 * run-based blocks in place of the QA ones; the QA Team gets the team
 * dashboard (homePersonaFor). */

import { createRepositoryHref } from "@/features/teams/project-folders";

import { newProjectHref } from "./home-rules";
import { homePersonaFor } from "./home-persona-rules";
import type {
  HomeBlockId,
  HomeBlockState,
  HomeDataNeeds,
  HomeLayout,
  HomeSectionKey,
  HomeSectionStates,
  HomeShortcut,
  HomeShortcutId,
} from "./home-persona-types";
import type { AppRole } from "./home-types";

const ROLE_HOME_NEEDS: HomeDataNeeds = { history: false, workspace: false, folders: true, qaOverview: true };
const NO_QA = { qaOverview: false } as const;

type LayoutKey =
  | "team"
  | "developer"
  | "developer-no-qa"
  | "qa"
  | "product-owner"
  | "product-owner-no-qa";

const LAYOUTS: Readonly<Record<LayoutKey, HomeLayout>> = {
  /* Today's team dashboard, rendered as is: its rail and blocks are its own. */
  team: {
    persona: "team",
    qa: false,
    metrics: [],
    main: [],
    side: [],
    shortcuts: ["create-project", "projects", "runs"],
    needs: { history: true, workspace: true, folders: false, qaOverview: false },
  },
  /* "What do I fix next?" Activity is never read. */
  developer: {
    persona: "developer",
    qa: true,
    metrics: ["scope-projects", "returned", "in-progress", "failing-runs", "success-rate"],
    main: ["returned-by-qa", "scoped-runs"],
    side: ["my-work", "quality"],
    shortcuts: ["add-repository", "projects", "runs"],
    needs: ROLE_HOME_NEEDS,
  },
  "developer-no-qa": {
    persona: "developer",
    qa: false,
    metrics: ["scope-projects", "repositories", "running", "failing-runs", "success-rate"],
    main: ["scoped-runs", "branch-health"],
    side: ["my-work", "quality"],
    shortcuts: ["add-repository", "projects", "runs"],
    needs: { ...ROLE_HOME_NEEDS, ...NO_QA },
  },
  /* "What do I verify next?" No N: the QA Team creates nothing. */
  qa: {
    persona: "qa",
    qa: true,
    metrics: ["in-verification", "pending-items", "failed-or-blocked", "ready-for-retest", "uat-pass-rate"],
    main: ["projects-in-verification", "uat-automation"],
    side: ["ready-for-retest", "defects"],
    shortcuts: ["projects", "runs"],
    needs: ROLE_HOME_NEEDS,
  },
  /* "What can ship, and what's stuck?" Lead and admin. */
  "product-owner": {
    persona: "product-owner",
    qa: true,
    metrics: ["projects", "awaiting-promotion", "need-attention", "failing-branches", "success-rate"],
    main: ["ready-for-production", "branch-health"],
    side: ["needs-attention", "quality"],
    shortcuts: ["create-project", "projects", "runs"],
    // History feeds the get-started journey an empty team shows a Product owner.
    needs: { ...ROLE_HOME_NEEDS, history: true },
  },
  "product-owner-no-qa": {
    persona: "product-owner",
    qa: false,
    metrics: ["projects", "repositories", "running", "failing-branches", "success-rate"],
    main: ["team-runs", "branch-health"],
    side: ["team-projects", "quality"],
    shortcuts: ["create-project", "projects", "runs"],
    needs: { ...ROLE_HOME_NEEDS, history: true, ...NO_QA },
  },
};

function layoutKey(
  persona: ReturnType<typeof homePersonaFor>,
  qaChecklistsEnabled: boolean,
): LayoutKey {
  if (persona === "team" || persona === "qa" || qaChecklistsEnabled) return persona;
  return `${persona}-no-qa`;
}

/** The role's Home: metrics, blocks, shortcuts and what to read. */
export function homeLayoutFor(input: {
  appRole: AppRole | null | undefined;
  qaChecklistsEnabled: boolean;
}): HomeLayout {
  return LAYOUTS[layoutKey(homePersonaFor(input), input.qaChecklistsEnabled)];
}

/* ── Keyboard shortcuts ─────────────────────────────────────────────────── */

export const HOME_SHORTCUTS: Readonly<Record<HomeShortcutId, HomeShortcut>> = {
  "add-repository": { id: "add-repository", key: "n", label: "Add repository" },
  "create-project": { id: "create-project", key: "n", label: "Create Project" },
  projects: { id: "projects", key: "w", label: "View Projects" },
  runs: { id: "runs", key: "r", label: "View Runs" },
};

/**
 * Where a shortcut goes. N is Add repository for a Developer (the wizard,
 * scoped to the team) and Create Project for a Product owner (the Projects
 * page, New Project dialog open); the QA Team has no N.
 */
export function homeShortcutHref(id: HomeShortcutId, groupId: string | null): string {
  switch (id) {
    case "add-repository":
      return groupId ? createRepositoryHref(groupId) : "/workflows?tab=setup";
    case "create-project":
      return newProjectHref(groupId);
    case "projects":
      return "/workflows?tab=current";
    default:
      return "/runs";
  }
}

/** The href for a pressed key, among the layout's shortcuts; null when it is not one. */
export function dashboardShortcutHref(
  key: string,
  shortcuts: ReadonlyArray<HomeShortcutId>,
  groupId: string | null,
): string | null {
  const match = shortcuts.find((id) => HOME_SHORTCUTS[id].key === key);
  return match ? homeShortcutHref(match, groupId) : null;
}

/* ── Block states ───────────────────────────────────────────────────────── */

/**
 * The sections each block waits on, its own source first. Only the first can
 * fail the block: a block whose scope came from the QA overview still renders
 * the team's data when that read failed.
 */
const BLOCK_SOURCES: Readonly<Record<HomeBlockId, readonly HomeSectionKey[]>> = {
  "returned-by-qa": ["qaOverview", "folders"],
  "scoped-runs": ["runs", "qaOverview", "folders"],
  "my-work": ["folders", "qaOverview", "runs"],
  quality: ["runs", "qaOverview", "folders"],
  "projects-in-verification": ["qaOverview", "folders"],
  "uat-automation": ["runs", "folders"],
  "ready-for-retest": ["qaOverview", "folders"],
  defects: ["qaOverview", "folders"],
  "ready-for-production": ["qaOverview", "folders"],
  "branch-health": ["runs", "folders"],
  "needs-attention": ["folders", "qaOverview"],
  "team-runs": ["runs"],
  "team-projects": ["projects"],
};

export function homeBlockState(block: HomeBlockId, states: HomeSectionStates): HomeBlockState {
  const sources = BLOCK_SOURCES[block];
  return {
    loading: sources.some((key) => states[key].status === "loading"),
    error: states[sources[0]].error,
  };
}

/** The metric rail waits for everything the layout reads. */
export function homeMetricsLoading(states: HomeSectionStates): boolean {
  return Object.values(states).some((state) => state.status === "loading");
}
