"use client";

import { useEffect, useRef, useState } from "react";

import { qaAttachmentsRepository } from "../../data/qa-attachments-repository";
import { isRunLocked } from "../../model/project-run-rules";
import type { ProjectQaRun } from "../../model/project-run-types";
import {
  anyUrlExpired,
  attachmentErrorMessage,
  attachmentsByItem,
  canAddEvidence,
  showsEvidence,
} from "../../model/qa-attachment-rules";
import type { QaAttachment } from "../../model/qa-attachment-types";

/**
 * `hidden`: the server has no screenshots (or storage is off), so nothing
 * shows; `loading` while the run's list is read (the previous list stays on
 * screen during a refresh); `error` when it could not be read.
 */
export type RunEvidenceStatus = "hidden" | "loading" | "ready" | "error";

export interface RunEvidenceViewModel {
  status: RunEvidenceStatus;
  /** Safe to render. */
  error: string | null;
  deliveryProjectId: string;
  runId: string;
  /** Capture, Paste and Upload are offered on this run for this viewer. */
  canAdd: boolean;
  /** Read-only on a signed-off run: no add, no delete. */
  open: boolean;
  /** One item's loaded screenshots; undefined until the list is read. */
  forItem: (itemId: string) => QaAttachment[] | undefined;
  /** Read the list again (signed URLs last five minutes). */
  reload: () => void;
  /** Read it again only when a URL has expired or is about to. */
  refreshIfExpired: () => void;
  added: (attachment: QaAttachment) => void;
  removed: (attachmentId: string) => void;
}

interface ListState {
  status: Exclude<RunEvidenceStatus, "hidden">;
  list: QaAttachment[] | null;
  error: string | null;
}

const LOAD_ERROR = "The screenshots could not be loaded. Try again in a moment.";

/** The run says at least one item may hold a screenshot (an unknown count may, too). */
function runMayHaveEvidence(run: ProjectQaRun): boolean {
  return showsEvidence(run) && run.items.some((item) => item.attachmentCount !== 0);
}

/**
 * ViewModel for a Project run's screenshots: reads the whole run's list once
 * (one request, not one per item), keeps what this viewer adds or removes in
 * step, and reads it again when a signed URL runs out. Mounted per run (the
 * run body is keyed by run id). An older backend sends no `attachments`
 * answer and this stays `hidden` without a request.
 */
export function useRunEvidenceViewModel(options: { deliveryProjectId: string; run: ProjectQaRun }): RunEvidenceViewModel {
  const { deliveryProjectId, run } = options;
  const visible = showsEvidence(run);
  const shouldLoad = runMayHaveEvidence(run);
  const [state, setState] = useState<ListState>(() =>
    shouldLoad ? { status: "loading", list: null, error: null } : { status: "ready", list: [], error: null },
  );
  const [attempt, setAttempt] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    if (!shouldLoad && attempt === 0) return;
    const id = ++requestId.current;
    qaAttachmentsRepository.listForRun(deliveryProjectId, run.id).then(
      (list) => {
        if (id === requestId.current) setState({ status: "ready", list, error: null });
      },
      (cause: unknown) => {
        if (id !== requestId.current) return;
        setState((previous) => ({ ...previous, status: "error", error: attachmentErrorMessage(cause, LOAD_ERROR) }));
      },
    );
  }, [deliveryProjectId, run.id, shouldLoad, attempt]);

  const byItem = state.list ? attachmentsByItem(state.list) : null;

  function reload() {
    setState((previous) => ({ ...previous, status: "loading", error: null }));
    setAttempt((value) => value + 1);
  }

  return {
    status: visible ? state.status : "hidden",
    error: visible ? state.error : null,
    deliveryProjectId,
    runId: run.id,
    canAdd: canAddEvidence(run),
    // A delivered iteration's run is frozen, even one left open.
    open: run.status === "open" && !isRunLocked(run),
    forItem: (itemId) => (byItem ? (byItem[itemId] ?? []) : undefined),
    reload,
    refreshIfExpired: () => {
      if (state.status !== "loading" && state.list && anyUrlExpired(state.list)) reload();
    },
    added: (attachment) =>
      setState((previous) => ({ ...previous, list: [...(previous.list ?? []), attachment] })),
    removed: (attachmentId) =>
      setState((previous) => ({
        ...previous,
        list: previous.list ? previous.list.filter((entry) => entry.id !== attachmentId) : previous.list,
      })),
  };
}
