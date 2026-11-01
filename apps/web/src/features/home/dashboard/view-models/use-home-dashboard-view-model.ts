"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useCapabilities } from "@/features/capabilities";
import { useWorkspaceSelection } from "@/features/workspace/selection";

import { homeRepository } from "../../data/home-repository";
import { homeLayoutFor } from "../../model/home-layout-rules";
import { buildPersonaDashboard } from "../../model/home-persona-dashboard";
import type {
  HomeLayout,
  HomeSectionStates,
  PersonaDashboard,
} from "../../model/home-persona-types";
import { computeRunStats, runsForTeam } from "../../model/home-rules";
import type {
  AppRole,
  DeliveryPortfolioNode,
  GroupActivityItem,
  GroupSummary,
  MyAssignedRepository,
  ProjectFoldersSnapshot,
  ProvisionedProject,
  RunGroup,
  RunStats,
  SectionStatus,
  TeamQaOverview,
  WorkflowHistoryItem,
} from "../../model/home-types";

/** One independently-loaded dashboard section. */
interface Section<T> {
  data: T;
  status: SectionStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
}

type WorkspaceData = {
  group: GroupSummary | null;
  portfolio: DeliveryPortfolioNode[];
  assignments: MyAssignedRepository[];
  activity: GroupActivityItem[];
};

type SectionKey = "history" | "projects" | "runs" | "workspace" | "folders" | "qaOverview";

export interface HomeDashboardViewModel {
  /** The role's Home: what it shows and what it reads. */
  layout: HomeLayout;
  history: Section<WorkflowHistoryItem[]>;
  projects: Section<ProvisionedProject[]>;
  runs: Section<RunGroup[]>;
  /**
   * The runs to show for the header team: `runs.data` unless the team has no
   * projects, in which case any run that arrived belongs to another team.
   */
  teamRuns: RunGroup[];
  /** Derived from teamRuns; recomputed only when the run list changes. */
  runStats: RunStats;
  /** The team dashboard's walk (and Activity). Never read by a role's Home. */
  workspace: Section<WorkspaceData>;
  /** The team's Projects with their repositories; null until read. */
  folders: Section<ProjectFoldersSnapshot | null>;
  /** The team's QA overview; null until read, or with the QA capability off. */
  qaOverview: Section<TeamQaOverview | null>;
  /** Each section's status, for the blocks that wait on them. */
  sections: HomeSectionStates;
  /** Everything a role's Home renders, derived from the sections above. */
  persona: PersonaDashboard;
  /** Re-read every section the layout reads. */
  reload: () => void;
  /** True once the welcome modal has been dismissed this session. */
  welcomeDismissed: boolean;
  /**
   * Hide the welcome modal and mark onboarding complete.
   *
   * Optimistic and fire-and-forget: the modal closes immediately and a failed
   * write is not surfaced, because the next sign-in simply shows it again.
   */
  dismissWelcome: () => void;
}

const EMPTY_WORKSPACE: WorkspaceData = { group: null, portfolio: [], assignments: [], activity: [] };

const ERRORS = {
  history: "Could not load workflow history.",
  projects: "Could not load projects.",
  workspace: "Some group information could not be loaded. You can still review your projects and runs.",
  folders: "Could not load this team's Projects.",
  qaOverview: "Could not load QA progress for this team.",
} as const;

function loadingSection<T>(data: T): Section<T> {
  return { data, status: "loading", error: null };
}

function readySection<T>(data: T): Section<T> {
  return { data, status: "ready", error: null };
}

/** A section with no error copy (runs) reports ready-and-empty: the page stays usable. */
function failedSection<T>(empty: T, error: string | null): Section<T> {
  return error === null ? readySection(empty) : { data: empty, status: "error", error };
}

/* What a section reads as when the layout does not read it: settled and
 * empty, so nothing waits on it. Constants, so derived values stay stable. */
const SKIPPED = {
  history: readySection<WorkflowHistoryItem[]>([]),
  workspace: readySection(EMPTY_WORKSPACE),
  folders: readySection<ProjectFoldersSnapshot | null>(null),
  qaOverview: readySection<TeamQaOverview | null>(null),
};

/**
 * Starts one section's read. A newer read of the same section supersedes it:
 * one counter per section, so a slow workspace walk cannot discard a newer
 * projects response, and vice versa.
 */
function sectionLoader(counters: Record<SectionKey, number>, isActive: () => boolean) {
  return function load<T>(
    key: SectionKey,
    read: Promise<T>,
    apply: (section: Section<T>) => void,
    empty: T,
    error: string | null,
  ): void {
    counters[key] += 1;
    const id = counters[key];
    const fresh = () => isActive() && id === counters[key];
    read.then(
      (data) => {
        if (fresh()) apply(readySection(data));
      },
      () => {
        if (fresh()) apply(failedSection(empty, error));
      },
    );
  };
}

function sectionState<T>(section: Section<T>) {
  return { status: section.status, error: section.error };
}

/**
 * ViewModel for the home dashboard.
 *
 * The role decides the Home (homeLayoutFor), and the Home decides what is
 * read: a Developer never reads the team walk or its Activity, and nobody
 * reads the QA overview with the QA capability off. Sections load and fail
 * independently, each with its own status and user-safe error, so a block
 * whose read failed leaves the others usable.
 */
export function useHomeDashboardViewModel(options: {
  /** Only fetch once the session is known good. */
  enabled: boolean;
  /** The signed-in role; missing or unknown keeps the team dashboard. */
  appRole?: AppRole | null;
}): HomeDashboardViewModel {
  const { enabled, appRole } = options;
  const { selectedWorkspaceId } = useWorkspaceSelection();
  const capabilities = useCapabilities();
  // Until the capabilities are known, lay out as if QA were on (what most
  // teams have) and read nothing that depends on it.
  const layoutSettled = capabilities.status !== "loading";
  const qaChecklistsEnabled = !layoutSettled || capabilities.qaChecklistsEnabled;
  const layout = useMemo(
    () => homeLayoutFor({ appRole, qaChecklistsEnabled }),
    [appRole, qaChecklistsEnabled],
  );
  const { needs } = layout;

  const [history, setHistory] = useState(loadingSection<WorkflowHistoryItem[]>([]));
  const [projects, setProjects] = useState(loadingSection<ProvisionedProject[]>([]));
  const [runs, setRuns] = useState(loadingSection<RunGroup[]>([]));
  const [workspace, setWorkspace] = useState(loadingSection(EMPTY_WORKSPACE));
  const [folders, setFolders] = useState(loadingSection<ProjectFoldersSnapshot | null>(null));
  const [qaOverview, setQaOverview] = useState(loadingSection<TeamQaOverview | null>(null));

  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const req = useRef<Record<SectionKey, number>>({
    history: 0, projects: 0, runs: 0, workspace: 0, folders: 0, qaOverview: 0,
  });

  // Every Home reads the team's projects and runs.
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = sectionLoader(req.current, () => active);
    load("projects", homeRepository.projects(selectedWorkspaceId), setProjects, [], ERRORS.projects);
    load("runs", homeRepository.recentRuns(selectedWorkspaceId), setRuns, [], null);
    return () => {
      active = false;
    };
  }, [enabled, selectedWorkspaceId, nonce]);

  // The rest only when the layout reads it, once the capabilities are known.
  useEffect(() => {
    if (!enabled || !layoutSettled) return;
    let active = true;
    const load = sectionLoader(req.current, () => active);
    const ws = selectedWorkspaceId;
    if (needs.history) load("history", homeRepository.workflowHistory(), setHistory, [], ERRORS.history);
    if (needs.workspace) {
      load("workspace", homeRepository.workspaceOverview(ws), setWorkspace, EMPTY_WORKSPACE, ERRORS.workspace);
    }
    if (needs.folders && ws) load("folders", homeRepository.projectFolders(ws), setFolders, null, ERRORS.folders);
    if (needs.qaOverview && ws) {
      load("qaOverview", homeRepository.teamQaOverview(ws), setQaOverview, null, ERRORS.qaOverview);
    }
    return () => {
      active = false;
    };
  }, [
    enabled,
    layoutSettled,
    selectedWorkspaceId,
    nonce,
    needs.history,
    needs.workspace,
    needs.folders,
    needs.qaOverview,
  ]);

  const hasWorkspace = Boolean(selectedWorkspaceId);
  const historySection = needs.history ? history : SKIPPED.history;
  const workspaceSection = needs.workspace ? workspace : SKIPPED.workspace;
  const foldersSection = needs.folders && hasWorkspace ? folders : SKIPPED.folders;
  const qaSection = needs.qaOverview && hasWorkspace ? qaOverview : SKIPPED.qaOverview;

  const teamRuns = useMemo(
    () => runsForTeam(runs.data, projects.data, projects.status === "ready"),
    [runs.data, projects.data, projects.status],
  );
  const runStats = useMemo(() => computeRunStats(teamRuns), [teamRuns]);
  const persona = useMemo(
    () =>
      buildPersonaDashboard({
        layout,
        groupId: selectedWorkspaceId,
        folders: foldersSection.data,
        overview: qaSection.data,
        teamRuns,
        projects: projects.data,
      }),
    [layout, selectedWorkspaceId, foldersSection.data, qaSection.data, teamRuns, projects.data],
  );
  const sections: HomeSectionStates = {
    projects: sectionState(projects),
    runs: sectionState(runs),
    folders: sectionState(foldersSection),
    qaOverview: sectionState(qaSection),
  };
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const dismissWelcome = useCallback(() => {
    setWelcomeDismissed(true);
    void homeRepository.completeOnboarding().catch(() => {
      // Non-fatal: the modal is already hidden, and onboarding is idempotent.
    });
  }, []);

  return {
    layout,
    history: historySection,
    projects,
    runs,
    teamRuns,
    runStats,
    workspace: workspaceSection,
    folders: foldersSection,
    qaOverview: qaSection,
    sections,
    persona,
    reload,
    welcomeDismissed,
    dismissWelcome,
  };
}
