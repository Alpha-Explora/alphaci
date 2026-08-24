"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useWorkspaceSelection } from "@/features/workspace/selection";

import { homeRepository } from "../../data/home-repository";
import { computeRunStats } from "../../model/home-rules";
import type {
  DeliveryPortfolioNode,
  GroupActivityItem,
  GroupSummary,
  MyAssignedRepository,
  ProvisionedProject,
  RunGroup,
  RunStats,
  SectionStatus,
  WorkflowHistoryItem,
} from "../../model/home-types";

/** One independently-loaded dashboard section. */
interface Section<T> {
  data: T;
  status: SectionStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
}

export interface HomeDashboardViewModel {
  history: Section<WorkflowHistoryItem[]>;
  projects: Section<ProvisionedProject[]>;
  runs: Section<RunGroup[]>;
  /** Derived from runs; recomputed only when the run list changes. */
  runStats: RunStats;
  workspace: Section<{
    group: GroupSummary | null;
    portfolio: DeliveryPortfolioNode[];
    assignments: MyAssignedRepository[];
    activity: GroupActivityItem[];
  }>;
  /** Re-read every section. */
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

/**
 * ViewModel for the home dashboard.
 *
 * The four sections load and fail independently — a group whose systems cannot
 * be read still leaves projects and runs usable, which is what the page did
 * before and is worth keeping. Each carries its own status and user-safe error
 * rather than one status for the page.
 */
export function useHomeDashboardViewModel(options: {
  /** Only fetch once the session is known good. */
  enabled: boolean;
}): HomeDashboardViewModel {
  const { enabled } = options;
  const { selectedWorkspaceId } = useWorkspaceSelection();

  const [history, setHistory] = useState<Section<WorkflowHistoryItem[]>>({
    data: [], status: "loading", error: null,
  });
  const [projects, setProjects] = useState<Section<ProvisionedProject[]>>({
    data: [], status: "loading", error: null,
  });
  const [runs, setRuns] = useState<Section<RunGroup[]>>({
    data: [], status: "loading", error: null,
  });
  const [workspace, setWorkspace] = useState<
    HomeDashboardViewModel["workspace"]
  >({
    data: { group: null, portfolio: [], assignments: [], activity: [] },
    status: "loading",
    error: null,
  });

  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [nonce, setNonce] = useState(0);
  // One counter per section: a slow workspace walk must not be able to discard
  // a newer projects response, and vice versa.
  const req = useRef({ history: 0, projects: 0, runs: 0, workspace: 0 });

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    const id = (k: keyof typeof req.current) => {
      req.current[k] += 1;
      return req.current[k];
    };
    const fresh = (k: keyof typeof req.current, n: number) =>
      active && n === req.current[k];

    const hId = id("history");
    homeRepository
      .workflowHistory()
      .then((items) => {
        if (fresh("history", hId)) setHistory({ data: items, status: "ready", error: null });
      })
      .catch(() => {
        if (fresh("history", hId))
          setHistory({ data: [], status: "error", error: "Could not load workflow history." });
      });

    const pId = id("projects");
    homeRepository
      .projects(selectedWorkspaceId)
      .then((items) => {
        if (fresh("projects", pId)) setProjects({ data: items, status: "ready", error: null });
      })
      .catch(() => {
        if (fresh("projects", pId))
          setProjects({ data: [], status: "error", error: "Could not load projects." });
      });

    const rId = id("runs");
    homeRepository
      .recentRuns()
      .then((list) => {
        if (fresh("runs", rId)) setRuns({ data: list, status: "ready", error: null });
      })
      .catch(() => {
        // A run list that will not load leaves the page usable, so this reports
        // ready-and-empty rather than an error banner, as it did before.
        if (fresh("runs", rId)) setRuns({ data: [], status: "ready", error: null });
      });

    const wId = id("workspace");
    homeRepository
      .workspaceOverview(selectedWorkspaceId)
      .then((data) => {
        if (fresh("workspace", wId)) setWorkspace({ data, status: "ready", error: null });
      })
      .catch(() => {
        if (fresh("workspace", wId))
          setWorkspace({
            data: { group: null, portfolio: [], assignments: [], activity: [] },
            status: "error",
            error:
              "Some group information could not be loaded. You can still review your projects and runs.",
          });
      });

    return () => {
      active = false;
    };
  }, [enabled, selectedWorkspaceId, nonce]);

  const runStats = useMemo(() => computeRunStats(runs.data), [runs.data]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const dismissWelcome = useCallback(() => {
    setWelcomeDismissed(true);
    void homeRepository.completeOnboarding().catch(() => {
      // Non-fatal: the modal is already hidden, and onboarding is idempotent.
    });
  }, []);

  return {
    history,
    projects,
    runs,
    runStats,
    workspace,
    reload,
    welcomeDismissed,
    dismissWelcome,
  };
}
