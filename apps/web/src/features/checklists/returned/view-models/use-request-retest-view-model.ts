"use client";

import { useState } from "react";

import { qaRunsRepository } from "../../data/qa-runs-repository";
import { qaActionError } from "../../model/qa-run-rules";
import type { QaActionError, QaRun } from "../../model/qa-run-types";

/** Which item the form is for: the run it sits on and its id. */
export interface RetestTarget {
  runId: string;
  itemId: string;
}

export interface RequestRetestViewModel {
  /** The form's state for the open item: closed, being written, or being sent. */
  status: "closed" | "editing" | "submitting";
  /** The item the note form is open on, as `runId:itemId`. */
  openKey: string | null;
  note: string;
  setNote: (value: string) => void;
  error: QaActionError | null;
  open: (target: RetestTarget) => void;
  cancel: () => void;
  submit: (target: RetestTarget) => Promise<void>;
}

const RETEST_ERROR = "The re-test could not be requested. Try again in a moment.";

export function retestKey(target: RetestTarget): string {
  return `${target.runId}:${target.itemId}`;
}

/**
 * ViewModel for "Mark fixed & request re-test": an optional note to QA, then
 * one request. Shared by the Overview card and the studio so a developer says
 * "fixed" the same way in both. The caller decides whether the viewer may,
 * from the run's permissions or, where there is no run, the role.
 */
export function useRequestRetestViewModel(options: {
  projectId: string;
  onDone: (run: QaRun) => void;
}): RequestRetestViewModel {
  const { projectId, onDone } = options;
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<QaActionError | null>(null);

  function open(target: RetestTarget) {
    setOpenKey(retestKey(target));
    setNote("");
    setError(null);
  }

  async function submit(target: RetestTarget) {
    if (submitting) return;
    setOpenKey(retestKey(target));
    setSubmitting(true);
    setError(null);
    try {
      const run = await qaRunsRepository.requestRetest(
        projectId,
        target.runId,
        target.itemId,
        note.trim() || null,
      );
      setOpenKey(null);
      setNote("");
      onDone(run);
    } catch (cause) {
      setError(qaActionError(cause, RETEST_ERROR));
    } finally {
      setSubmitting(false);
    }
  }

  function formStatus(): RequestRetestViewModel["status"] {
    if (submitting) return "submitting";
    return openKey ? "editing" : "closed";
  }

  return {
    status: formStatus(),
    openKey,
    note,
    setNote,
    error,
    open,
    cancel: () => {
      if (submitting) return;
      setOpenKey(null);
      setError(null);
    },
    submit,
  };
}
