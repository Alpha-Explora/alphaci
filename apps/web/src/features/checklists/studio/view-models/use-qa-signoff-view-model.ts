"use client";

import { useState } from "react";

import { qaRunsRepository } from "../../data/qa-runs-repository";
import {
  defaultVerdict,
  isSignedOff,
  qaActionError,
  signoffEligibility,
  signoffError,
  signoffPayload,
  type VerdictEligibility,
} from "../../model/qa-run-rules";
import type { QaActionError, QaRun, QaVerdict } from "../../model/qa-run-types";

export type QaSignoffStatus = "closed" | "editing" | "submitting";

export interface QaSignoffViewModel {
  /** The dialog's state: closed, being filled in, or being sent. */
  status: QaSignoffStatus;
  /** Server-decided, and never for a run already signed off. */
  canSignOff: boolean;
  eligibility: VerdictEligibility[];
  verdict: QaVerdict;
  setVerdict: (verdict: QaVerdict) => void;
  summary: string;
  setSummary: (value: string) => void;
  conditions: string;
  setConditions: (value: string) => void;
  /** Why the chosen verdict cannot be sent. Shown once Sign off was tried. */
  validationError: string | null;
  error: QaActionError | null;
  openDialog: () => void;
  closeDialog: () => void;
  submit: () => Promise<void>;
}

const SIGNOFF_ERROR = "The run could not be signed off. Try again in a moment.";

/**
 * ViewModel for signing a run off. The verdicts on offer mirror the server:
 * Approved only when every item passed, Conditional once nothing is pending
 * or in progress (with the conditions written down), Rejected always. The
 * server checks again; its 409 message is shown as it comes.
 */
export function useQaSignoffViewModel(options: {
  projectId: string;
  run: QaRun;
  onRun: (run: QaRun) => void;
}): QaSignoffViewModel {
  const { projectId, run, onRun } = options;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verdict, setVerdict] = useState<QaVerdict>("REJECTED");
  const [summary, setSummary] = useState("");
  const [conditions, setConditions] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<QaActionError | null>(null);
  const canSignOff = run.permissions.canSignOff && !isSignedOff(run);

  function openDialog() {
    if (!canSignOff) return;
    setVerdict(defaultVerdict(run));
    setSummary("");
    setConditions("");
    setAttempted(false);
    setError(null);
    setOpen(true);
  }

  function chooseVerdict(next: QaVerdict) {
    setVerdict(next);
    setError(null);
  }

  async function submit() {
    if (!canSignOff || submitting) return;
    setAttempted(true);
    if (signoffError(run, verdict, conditions)) return;
    setSubmitting(true);
    setError(null);
    try {
      const next = await qaRunsRepository.signoff(
        projectId,
        run.id,
        signoffPayload(verdict, summary, conditions),
      );
      onRun(next);
      setOpen(false);
    } catch (cause) {
      setError(qaActionError(cause, SIGNOFF_ERROR));
    } finally {
      setSubmitting(false);
    }
  }

  function dialogStatus(): QaSignoffStatus {
    if (!open) return "closed";
    return submitting ? "submitting" : "editing";
  }

  return {
    status: dialogStatus(),
    canSignOff,
    eligibility: signoffEligibility(run),
    verdict,
    setVerdict: chooseVerdict,
    summary,
    setSummary,
    conditions,
    setConditions,
    validationError: attempted ? signoffError(run, verdict, conditions) : null,
    error,
    openDialog,
    closeDialog: () => {
      if (!submitting) setOpen(false);
    },
    submit,
  };
}
