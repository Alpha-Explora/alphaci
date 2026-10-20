"use client";

import { useState } from "react";

import { projectQaRunsRepository } from "../../data/project-qa-runs-repository";
import type { ProjectQaRun, ProjectQaRunItem } from "../../model/project-run-types";
import { qaActionError } from "../../model/qa-run-rules";
import type { QaActionError, QaDefectSeverity } from "../../model/qa-run-types";

export interface PoFailDraft {
  itemId: string;
  notes: string;
  severity: QaDefectSeverity;
}

export interface PoAcceptanceViewModel {
  /** The Product owner may pass or fail items (QA signed the run off; the server says so). */
  canAccept: boolean;
  /** The item whose write is in flight. */
  busyItemId: string | null;
  /** The open "Fail and return to Development" form, one at a time. */
  failing: PoFailDraft | null;
  /** Why the open form cannot be sent yet. Shown once it was tried. */
  failError: string | null;
  error: (QaActionError & { itemId: string }) | null;
  pass: (item: ProjectQaRunItem) => Promise<void>;
  openFail: (item: ProjectQaRunItem) => void;
  updateFail: (patch: Partial<Pick<PoFailDraft, "notes" | "severity">>) => void;
  cancelFail: () => void;
  submitFail: (item: ProjectQaRunItem) => Promise<void>;
  dismissError: () => void;
}

const WRITE_ERROR = "Your decision could not be saved. Try again in a moment.";
export const PO_FAIL_NOTES_REQUIRED = "Say what is wrong, so the Developers know what to fix.";

/**
 * ViewModel for the Product owner's check of a signed-off run: Pass records
 * the acceptance; Fail (with notes) reopens the run and returns the story to
 * the Developers, who are told, as is the QA Team. Every write answers with
 * the whole run, which the panel adopts; `onChanged` re-reads what depends on
 * it (the readiness chip and Merge to main).
 */
export function usePoAcceptanceViewModel(options: {
  deliveryProjectId: string;
  run: ProjectQaRun;
  canAccept: boolean;
  onRun: (run: ProjectQaRun) => void;
  onReload: () => void;
  onChanged?: () => void;
}): PoAcceptanceViewModel {
  const { deliveryProjectId, run, canAccept, onRun, onReload, onChanged } = options;
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [failing, setFailing] = useState<PoFailDraft | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<(QaActionError & { itemId: string }) | null>(null);

  async function decide(
    item: ProjectQaRunItem,
    input: { decision: "passed" | "failed"; notes?: string; defectSeverity?: QaDefectSeverity },
  ): Promise<boolean> {
    if (!canAccept || busyItemId || item.rowVersion === null) return false;
    setBusyItemId(item.id);
    setError(null);
    try {
      const saved = await projectQaRunsRepository.acceptItem(deliveryProjectId, run.id, item.id, {
        ...input,
        expectedRowVersion: item.rowVersion,
      });
      if (saved) onRun(saved);
      else onReload();
      onChanged?.();
      return true;
    } catch (cause) {
      setError({ itemId: item.id, ...qaActionError(cause, WRITE_ERROR) });
      return false;
    } finally {
      setBusyItemId(null);
    }
  }

  function closeFail() {
    setFailing(null);
    setAttempted(false);
  }

  return {
    canAccept,
    busyItemId,
    failing,
    failError: attempted && failing && !failing.notes.trim() ? PO_FAIL_NOTES_REQUIRED : null,
    error,
    pass: async (item) => {
      await decide(item, { decision: "passed" });
    },
    openFail: (item) => {
      setFailing({ itemId: item.id, notes: "", severity: item.defectSeverity ?? "major" });
      setAttempted(false);
      setError(null);
    },
    updateFail: (patch) => setFailing((current) => (current ? { ...current, ...patch } : current)),
    cancelFail: closeFail,
    submitFail: async (item) => {
      if (!failing || failing.itemId !== item.id) return;
      setAttempted(true);
      const notes = failing.notes.trim();
      if (!notes) return;
      if (await decide(item, { decision: "failed", notes, defectSeverity: failing.severity })) closeFail();
    },
    dismissError: () => setError(null),
  };
}
