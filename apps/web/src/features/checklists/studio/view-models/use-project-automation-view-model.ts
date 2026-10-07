"use client";

import { useRef, useState } from "react";

import type { AppRole } from "@/shared/api/contracts";

import { projectQaRunsRepository } from "../../data/project-qa-runs-repository";
import {
  projectDispatchConfirmation,
  projectDispatchFailures,
  projectDispatchWarning,
  projectVerifySettledSince,
} from "../../model/playwright-tab-rules";
import type { ProjectDispatchResult, ProjectQaRun } from "../../model/project-run-types";
import {
  AUTOMATION_POLL_WINDOW_MS,
  dispatchBlockedReason,
  dispatchError,
  qaSignInHref,
  roleCanDispatch,
  type QaDispatchError,
} from "../../model/qa-automation-rules";
import { useAutomationPoll, type PollWindow } from "./use-automation-poll";
import type { AutomationDispatchControls, QaAutomationStatus } from "./use-qa-automation-view-model";

type Outcome =
  | { status: "idle" | "dispatching" }
  | { status: "dispatched"; result: ProjectDispatchResult }
  | { status: "failed"; error: QaDispatchError };

function publicStatus(outcome: Outcome, watching: boolean): QaAutomationStatus {
  if (outcome.status !== "dispatched") return outcome.status;
  return watching ? "watching" : "dispatched";
}

/**
 * Who is offered the button: the role rule (QA Team, Team lead, Admin). A
 * run the server says this viewer may not dispatch on — while it is still
 * open, so not for the sign-off it already explains — hides it too.
 */
function offersDispatch(run: ProjectQaRun, appRole: AppRole | null | undefined): boolean {
  if (!roleCanDispatch(appRole)) return false;
  return run.status !== "open" || run.permissions.canDispatch !== false;
}

/**
 * "Run Playwright" on a Project run: starts the verify workflow on uat in
 * every repository the run covers (the server picks the workflow and ref),
 * then re-reads the run every 20 s for up to 10 minutes — stopping early once
 * every repository it started in has reported — and hands each read to
 * `onRun`, so the Checklist and Playwright tabs both show what arrived.
 * Results are information: no item's Verification is touched here.
 */
export function useProjectAutomationViewModel(options: {
  deliveryProjectId: string;
  run: ProjectQaRun;
  appRole: AppRole | null | undefined;
  onRun: (run: ProjectQaRun) => void;
  /** The repository page this studio is on, for "Sign in again". */
  projectId: string;
}): AutomationDispatchControls {
  const { deliveryProjectId, run, appRole, onRun, projectId } = options;
  const [outcome, setOutcome] = useState<Outcome>({ status: "idle" });
  const [poll, setPoll] = useState<PollWindow | null>(null);
  const busy = useRef(false);
  const canDispatch = offersDispatch(run, appRole);
  const blockedReason = dispatchBlockedReason(run);
  const started = outcome.status === "dispatched" ? outcome.result : null;
  const watched = started ? started.dispatched.map((entry) => entry.projectId) : [];

  useAutomationPoll({
    key: `${deliveryProjectId}|${run.id}`,
    poll,
    read: () => projectQaRunsRepository.get(deliveryProjectId, run.id),
    onValue: onRun,
    settled: (value, since) => projectVerifySettledSince(value, watched, since),
    onStop: () => setPoll(null),
  });

  async function dispatch() {
    if (!canDispatch || blockedReason || busy.current) return;
    busy.current = true;
    setOutcome({ status: "dispatching" });
    try {
      const result = await projectQaRunsRepository.dispatchAutomation(deliveryProjectId, run.id);
      const at = Date.now();
      setOutcome({ status: "dispatched", result });
      if (result.dispatched.length > 0) setPoll({ since: at, until: at + AUTOMATION_POLL_WINDOW_MS });
    } catch (cause) {
      setOutcome({ status: "failed", error: dispatchError(cause) });
    } finally {
      busy.current = false;
    }
  }

  return {
    status: publicStatus(outcome, poll !== null),
    canDispatch,
    blockedReason,
    confirmation: started ? projectDispatchConfirmation(started) : null,
    warning: started ? projectDispatchWarning(started) : null,
    failures: started ? projectDispatchFailures(started) : [],
    error: outcome.status === "failed" ? outcome.error : null,
    signInHref: qaSignInHref(projectId),
    dispatch,
    // Clears a failure only; a started workflow's confirmation stays.
    dismiss: () => setOutcome((current) => (current.status === "failed" ? { status: "idle" } : current)),
  };
}
