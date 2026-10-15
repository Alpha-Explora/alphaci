"use client";

import { useEffect, useRef, useState } from "react";

import { iterationsRepository } from "../../data/iterations-repository";
import { projectQaRunsRepository } from "../../data/project-qa-runs-repository";
import { useIterationEpoch } from "../../iteration";
import type { HistoryIteration } from "../../model/iteration-types";
import type { ProjectQaRun } from "../../model/project-run-types";
import { errorStatus } from "../../model/wire-readers";

/** `unavailable`: this backend has no iterations route (a 404); the tab says so. */
export type IterationHistoryStatus = "idle" | "loading" | "ready" | "error" | "unavailable";

/** One delivered iteration's frozen QA report, read when its card is first opened. */
export type HistoryReport =
  | { status: "loading" }
  | { status: "ready"; run: ProjectQaRun }
  | { status: "error"; message: string };

export interface IterationHistoryViewModel {
  status: IterationHistoryStatus;
  iterations: HistoryIteration[];
  error: string | null;
  /** Which cards are open, by iteration id. */
  open: Readonly<Record<string, boolean>>;
  /** The frozen report of each opened delivered iteration, by its sign-off run id. */
  reports: Readonly<Record<string, HistoryReport>>;
  toggle: (iteration: HistoryIteration) => void;
  /** Read a report again after it failed. */
  retryReport: (iteration: HistoryIteration) => void;
  reload: () => void;
}

const LOAD_ERROR = "The Project's history could not be loaded. Try again in a moment.";
const REPORT_ERROR = "This iteration's QA results could not be loaded. Try again in a moment.";

interface Loaded {
  key: string;
  iterations: HistoryIteration[];
  status: "ready" | "error" | "unavailable";
}

function statusOf(active: boolean, loaded: Loaded | null): IterationHistoryStatus {
  if (!active) return "idle";
  return loaded ? loaded.status : "loading";
}

/**
 * ViewModel for the Project's History tab: every iteration, newest first,
 * and — once a delivered iteration's card is opened — its checklist and QA
 * results as QA signed them off (the sign-off run's frozen report, read
 * once and kept). A started iteration (the Project's epoch) reads the list
 * again. Read-only: nothing here writes.
 */
export function useIterationHistoryViewModel(options: {
  deliveryProjectId: string | null;
  enabled: boolean;
}): IterationHistoryViewModel {
  const { deliveryProjectId, enabled } = options;
  const key = deliveryProjectId ?? "";
  const active = enabled && Boolean(deliveryProjectId);
  const [nonce, setNonce] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [reports, setReports] = useState<Record<string, HistoryReport>>({});
  const requestRef = useRef(0);
  const epoch = useIterationEpoch(active ? key : null);

  useEffect(() => {
    if (!active) return;
    requestRef.current += 1;
    const requestId = requestRef.current;
    iterationsRepository
      .list(key)
      .then((iterations) => {
        if (requestId === requestRef.current) setLoaded({ key, iterations, status: "ready" });
      })
      .catch((cause: unknown) => {
        if (requestId !== requestRef.current) return;
        const status = errorStatus(cause) === 404 ? "unavailable" : "error";
        setLoaded({ key, iterations: [], status });
      });
  }, [active, key, nonce, epoch]);

  function loadReport(runId: string) {
    setReports((current) => ({ ...current, [runId]: { status: "loading" } }));
    projectQaRunsRepository
      .get(key, runId)
      .then((run) => setReports((current) => ({ ...current, [runId]: { status: "ready", run } })))
      .catch(() => setReports((current) => ({ ...current, [runId]: { status: "error", message: REPORT_ERROR } })));
  }

  function toggle(iteration: HistoryIteration) {
    const opening = !open[iteration.id];
    setOpen((current) => ({ ...current, [iteration.id]: opening }));
    const runId = iteration.status === "delivered" ? iteration.signoffRunId : null;
    if (opening && runId && !reports[runId]) loadReport(runId);
  }

  const current = loaded?.key === key ? loaded : null;
  return {
    status: statusOf(active, current),
    iterations: current?.iterations ?? [],
    error: current?.status === "error" ? LOAD_ERROR : null,
    open,
    reports,
    toggle,
    retryReport: (iteration) => {
      if (iteration.signoffRunId) loadReport(iteration.signoffRunId);
    },
    reload: () => setNonce((value) => value + 1),
  };
}
