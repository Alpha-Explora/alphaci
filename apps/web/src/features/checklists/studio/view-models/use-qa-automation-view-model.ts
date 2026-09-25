"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { AppRole } from "@/shared/api/contracts";

import { qaRunsRepository } from "../../data/qa-runs-repository";
import {
  AUTOMATION_POLL_INTERVAL_MS,
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

/**
 * `watching` — started, and re-reading the run every 20 s so results land
 * without a manual refresh. `dispatched` — started, no longer watching (the
 * results arrived, or the 10-minute window closed).
 */
export type QaAutomationStatus = "idle" | "dispatching" | "watching" | "dispatched" | "failed";

export interface QaAutomationViewModel {
  status: QaAutomationStatus;
  /** Normalised: absent or partial data reads as null stages, never a crash. */
  automation: QaRunAutomationResult;
  hasResults: boolean;
  /** Whether to offer "Run Playwright" at all (QA Team, Team lead, Admin). */
  canDispatch: boolean;
  /** Why the offered button is disabled, e.g. a signed-off run. */
  blockedReason: string | null;
  /** For the live region once the workflow has started. */
  confirmation: string | null;
  /** When the workflow will test a newer commit than this run's. */
  warning: string | null;
  error: QaDispatchError | null;
  signInHref: string;
  dispatch: () => Promise<void>;
  /** Dismiss a failed dispatch's message. */
  dismiss: () => void;
}

type Outcome =
  | { status: "idle" | "dispatching" }
  | { status: "dispatched"; dispatch: QaAutomationDispatch }
  | { status: "failed"; error: QaDispatchError };

interface PollWindow {
  since: number;
  until: number;
}

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function pageVisible(): boolean {
  return document.visibilityState !== "hidden";
}

function serverVisible(): boolean {
  return true;
}

function publicStatus(outcome: Outcome, watching: boolean): QaAutomationStatus {
  if (outcome.status !== "dispatched") return outcome.status;
  return watching ? "watching" : "dispatched";
}

/**
 * Re-reads the run every interval while `poll` is open and the page is
 * visible. Hidden tabs pause (the window keeps closing); unmount stops.
 */
function useRunPolling(options: {
  projectId: string;
  runId: string;
  poll: PollWindow | null;
  visible: boolean;
  onRun: (run: QaRun) => void;
  onStop: () => void;
}) {
  const { projectId, runId, poll, visible } = options;
  const callbacks = useRef({ onRun: options.onRun, onStop: options.onStop });
  const requestRef = useRef(0);

  useEffect(() => {
    callbacks.current = { onRun: options.onRun, onStop: options.onStop };
  });

  useEffect(() => {
    if (!poll || !visible) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= poll.until) {
        callbacks.current.onStop();
        return;
      }
      requestRef.current += 1;
      const requestId = requestRef.current;
      qaRunsRepository
        .get(projectId, runId)
        .then((run) => {
          if (requestId !== requestRef.current) return;
          callbacks.current.onRun(run);
          if (verifySettledSince(normalizeRunAutomation(run.automation), poll.since)) callbacks.current.onStop();
        })
        // A missed poll is not worth a message: the next tick tries again.
        .catch(() => undefined);
    }, AUTOMATION_POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      requestRef.current += 1;
    };
  }, [poll, visible, projectId, runId]);
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
  const visible = useSyncExternalStore(subscribeVisibility, pageVisible, serverVisible);
  const automation = normalizeRunAutomation(run.automation);
  const canDispatch = roleCanDispatch(appRole);
  const blockedReason = dispatchBlockedReason(run);

  useRunPolling({ projectId, runId: run.id, poll, visible, onRun, onStop: () => setPoll(null) });

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
    error: outcome.status === "failed" ? outcome.error : null,
    signInHref: qaSignInHref(projectId),
    dispatch,
    // Clears a failure only; a started workflow's confirmation stays.
    dismiss: () => setOutcome((current) => (current.status === "failed" ? { status: "idle" } : current)),
  };
}
