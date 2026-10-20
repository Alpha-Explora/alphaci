"use client";

import { useEffect, useRef, useState } from "react";

import { qaAttachmentsRepository } from "../../data/qa-attachments-repository";
import { useAttachmentGroupViewModel, type AttachmentGroupViewModel, type AttachmentSource } from "../../evidence";
import type { ProjectQaRunItem } from "../../model/project-run-types";
import { anyUrlExpired, attachmentErrorMessage } from "../../model/qa-attachment-rules";
import type { QaAttachment } from "../../model/qa-attachment-types";

/**
 * `loading` while the item's screenshots are read (an item the run says has
 * none is not read at all); `error` when they could not be; `ready` after.
 */
export type FixProofStatus = "loading" | "ready" | "error";

export interface FixProofViewModel {
  status: FixProofStatus;
  /** Safe to render: the item's list could not be read. */
  error: string | null;
  /** Read the item's list again (and, when the owner asked, the feed it came from). */
  reload: () => void;
  /** The Developer's group: thumbnails, Paste and Upload (no Capture), caption, Delete where allowed. */
  group: AttachmentGroupViewModel;
}

interface ListState {
  status: FixProofStatus;
  list: QaAttachment[] | null;
  error: string | null;
}

const LOAD_ERROR = "The screenshots of the fix could not be loaded. Try again in a moment.";

/**
 * One run item's screenshots, as an attachment source: read once with
 * `listForItem` (every kind; the group keeps the fix proofs), kept in step
 * with what this viewer adds or removes, and read again when a signed URL
 * runs out. `onStale` lets the owner re-read whatever told it the item may
 * take proof (a refusal can mean QA moved the item since).
 */
function useItemAttachmentSource(options: {
  deliveryProjectId: string;
  runId: string;
  runItem: ProjectQaRunItem;
  onStale?: () => void;
}): { state: ListState; source: AttachmentSource; retry: () => void } {
  const { deliveryProjectId, runId, runItem, onStale } = options;
  const shouldLoad = runItem.fixProofCount !== 0;
  const [state, setState] = useState<ListState>(() =>
    shouldLoad ? { status: "loading", list: null, error: null } : { status: "ready", list: [], error: null },
  );
  const [attempt, setAttempt] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    if (!shouldLoad && attempt === 0) return;
    const id = ++requestId.current;
    qaAttachmentsRepository.listForItem(deliveryProjectId, runId, runItem.id).then(
      (list) => {
        if (id === requestId.current) setState({ status: "ready", list, error: null });
      },
      (cause: unknown) => {
        if (id !== requestId.current) return;
        setState((previous) => ({ ...previous, status: "error", error: attachmentErrorMessage(cause, LOAD_ERROR, "fix_proof") }));
      },
    );
  }, [deliveryProjectId, runId, runItem.id, shouldLoad, attempt]);

  function retry() {
    setState((previous) => ({ ...previous, status: "loading", error: null }));
    setAttempt((value) => value + 1);
  }

  const source: AttachmentSource = {
    deliveryProjectId,
    runId,
    // The feed does not carry the run's state: the server's `canDelete` and
    // its refusal of a signed-off run decide.
    open: true,
    forItem: (itemId) => (itemId === runItem.id && state.list ? state.list : undefined),
    reload: () => {
      retry();
      onStale?.();
    },
    refreshIfExpired: () => {
      if (state.status !== "loading" && state.list && anyUrlExpired(state.list)) retry();
    },
    added: (attachment) => setState((previous) => ({ ...previous, list: [...(previous.list ?? []), attachment] })),
    removed: (attachmentId) =>
      setState((previous) => ({
        ...previous,
        list: previous.list ? previous.list.filter((entry) => entry.id !== attachmentId) : previous.list,
      })),
  };
  return { state, source, retry };
}

/**
 * ViewModel for a Developer's "Proof of the fix" on one My QA items entry:
 * screenshots that show the fix, attached to the run item at once (they do
 * not wait for Done). Paste and Upload only: a Developer has no QA Studio
 * preview to capture. The server's `canAttachFixProof` decides whether they
 * may add; each attachment's `canDelete` whether they may remove it.
 */
export function useFixProofViewModel(options: {
  deliveryProjectId: string;
  runId: string;
  runItem: ProjectQaRunItem;
  onStale?: () => void;
}): FixProofViewModel {
  const { state, source, retry } = useItemAttachmentSource(options);
  const group = useAttachmentGroupViewModel({
    itemId: options.runItem.id,
    group: "fix_proof",
    source,
    countFromRun: options.runItem.fixProofCount,
    mayAdd: options.runItem.canAttachFixProof,
    capture: null,
  });
  return { status: state.status, error: state.error, reload: retry, group };
}
