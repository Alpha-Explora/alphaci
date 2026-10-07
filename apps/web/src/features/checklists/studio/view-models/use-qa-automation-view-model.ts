"use client";

import { useRef, useState } from "react";

import type { AppRole } from "@/shared/api/contracts";

import { qaRunsRepository } from "../../data/qa-runs-repository";
import {
  AUTOMATION_POLL_WINDOW_MS,
  dispatchBlockedReason,
  dispatchConfirmation,
  dispatchError,
  dispatchMovedWarning,
  hasStageResults,
  normalizeDispatch,
  normalizeRunAutomation,
  qaSignInHref,
  roleCanDispatch,
  verifySettledSince,
  type QaDispatchError,
} from "../../model/qa-automation-rules";
import type { QaAutomationDispatch, QaRunAutomationResult } from "../../model/qa-automation-types";
import type { QaRun } from "../../model/qa-run-types";
import { useAutomationPoll, type PollWindow } from "./use-automation-poll";

/**
 * `watching` — started, and re-reading the run every 20 s so results land
 * without a manual refresh. `dispatched` — started, no longer watching (the
 * results arrived, or the 10-minute window closed).
 */
export type QaAutomationStatus = "idle" | "dispatching" | "watching" | "dispatched" | "failed";

/**
 * "Run Playwright" and what it said, the same for a repository run and a
 * Project run: the Playwright tab draws either through this shape.
 */
export interface AutomationDispatchControls {
  status: QaAutomationStatus;
  /** Whether to offer "Run Playwright" at all (QA Team, Team lead, Admin). */
  canDispatch: boolean;
  /** Why the offered button is disabled, e.g. a signed-off run. */
  blockedReason: string | null;
  /** For the live region once the workflow has started. */
  confirmation: string | null;
  /** When the workflow will test a newer commit than this run's. */
  warning: string | null;
  /** Repositories GitHub refused while others started: "repo — reason" lines. */
  failures: string[];
  error: QaDispatchError | null;
  signInHref: string;
  dispatch: () => Promise<void>;
  /** Dismiss a failed dispatch's message. */
  dismiss: () => void;
}

export interface QaAutomationViewModel extends AutomationDispatchControls {
  /** Normalised: absent or partial data reads as null stages, never a crash. */
  automation: QaRunAutomationResult;
  hasResults: boolean;
}

type Outcome =
  | { status: "idle" | "dispatching" }
  | { status: "dispatched"; dispatch: QaAutomationDispatch }
  | { status: "failed"; error: QaDispatchError };

function publicStatus(outcome: Outcome, watching: boolean): QaAutomationStatus {
  if (outcome.status !== "dispatched") return outcome.status;
  return watching ? "watching" : "dispatched";
}

/**
 * ViewModel for a run's automated results and "Run Playwright".
 *
 * The results are read from the run the server returned — normalised, so an
 * older backend or an older frozen copy simply shows no results. Starting
 * Playwright asks the server to dispatch the verify workflow; the server picks
 * the ref and reports whether that is still this run's commit. The run's
 * manual statuses are never touched here.
 */
export function useQaAutomationViewModel(options: {
  projectId: string;
  run: QaRun;
  appRole: AppRole | null | undefined;
  onRun: (run: QaRun) => void;
}): QaAutomationViewModel {
  const { projectId, run, appRole, onRun } = options;
  const [outcome, setOutcome] = useState<Outcome>({ status: "idle" });
  const [poll, setPoll] = useState<PollWindow | null>(null);
  const busy = useRef(false);
  const automation = normalizeRunAutomation(run.automation);
  const canDispatch = roleCanDispatch(appRole);
  const blockedReason = dispatchBlockedReason(run);

  useAutomationPoll({
    key: `${projectId}|${run.id}`,
    poll,
    read: () => qaRunsRepository.get(projectId, run.id),
    onValue: onRun,
    settled: (value, since) => verifySettledSince(normalizeRunAutomation(value.automation), since),
    onStop: () => setPoll(null),
  });

  async function dispatch() {
    if (!canDispatch || blockedReason || busy.current) return;
    busy.current = true;
    setOutcome({ status: "dispatching" });
    try {
      const started = normalizeDispatch(await qaRunsRepository.dispatchAutomation(projectId, run.id));
      const at = Date.now();
      setOutcome({ status: "dispatched", dispatch: started });
      setPoll({ since: at, until: at + AUTOMATION_POLL_WINDOW_MS });
    } catch (cause) {
      setOutcome({ status: "failed", error: dispatchError(cause) });
    } finally {
      busy.current = false;
    }
  }

  const started = outcome.status === "dispatched" ? outcome.dispatch : null;

  return {
    status: publicStatus(outcome, poll !== null),
    automation,
    hasResults: hasStageResults(automation),
    canDispatch,
    blockedReason,
    confirmation: started ? dispatchConfirmation(started, run) : null,
    warning: started ? dispatchMovedWarning(started, run) : null,
    failures: [],
    error: outcome.status === "failed" ? outcome.error : null,
    signInHref: qaSignInHref(projectId),
    dispatch,
    // Clears a failure only; a started workflow's confirmation stays.
    dismiss: () => setOutcome((current) => (current.status === "failed" ? { status: "idle" } : current)),
  };
}
