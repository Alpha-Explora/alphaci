"use client";

import { useState } from "react";

import { projectQaRunsRepository } from "../../data/project-qa-runs-repository";
import {
  allowedVerificationStatuses,
  canVerifyItem,
  verificationPayload,
} from "../../model/project-run-rules";
import type {
  ProjectQaRun,
  ProjectQaRunItem,
  ProjectQaRunPermissions,
  VerificationStatus,
} from "../../model/project-run-types";
import { itemDraftError, itemDraftFrom, qaActionError, statusNeedsSeverity } from "../../model/qa-run-rules";
import type { QaActionError, QaItemDraft } from "../../model/qa-run-types";

export type ProjectVerificationStatus = "idle" | "saving";

export interface ProjectVerificationViewModel {
  /** `saving` while one item's write is in flight. */
  status: ProjectVerificationStatus;
  savingItemId: string | null;
  /** The item whose details are open, with what is typed into it. */
  openItemId: string | null;
  draft: QaItemDraft | null;
  /** Why the open draft cannot be saved yet. Shown once Save was tried. */
  draftError: string | null;
  /** The last failed write, on the item it failed on. */
  error: (QaActionError & { itemId: string }) | null;
  allowedStatuses: (item: ProjectQaRunItem) => VerificationStatus[];
  chooseStatus: (item: ProjectQaRunItem, status: VerificationStatus) => void;
  openDetails: (item: ProjectQaRunItem) => void;
  closeDetails: () => void;
  updateDraft: (patch: Partial<QaItemDraft>) => void;
  saveDraft: (item: ProjectQaRunItem) => Promise<void>;
  dismissError: () => void;
}

const SAVE_ERROR = "The Verification could not be saved. Try again in a moment.";

/**
 * ViewModel for recording Verification on a Project run's items.
 *
 * Pending, Passed and Blocked save the moment they are picked; Failed and
 * Returned to dev open the item's details first, because the server refuses
 * them without a severity. Passed is only offered once a Developer marked the
 * item Done. Every write carries the row version read; a 409 comes back
 * flagged stale so the view can offer "Reload run".
 */
export function useProjectVerificationViewModel(options: {
  deliveryProjectId: string;
  run: ProjectQaRun;
  permissions: ProjectQaRunPermissions;
  onRun: (run: ProjectQaRun) => void;
  /** The write succeeded but returned no run: read it again. */
  onReload: () => void;
}): ProjectVerificationViewModel {
  const { deliveryProjectId, run, permissions, onRun, onReload } = options;
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QaItemDraft | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<(QaActionError & { itemId: string }) | null>(null);

  const allowedStatuses = (item: ProjectQaRunItem) => allowedVerificationStatuses(item, run, permissions);

  function open(item: ProjectQaRunItem, status: QaItemDraft["status"] = item.status) {
    setOpenItemId(item.id);
    setDraft(itemDraftFrom(item, status));
    setAttempted(false);
    setError(null);
  }

  function closeDetails() {
    setOpenItemId(null);
    setDraft(null);
    setAttempted(false);
  }

  async function send(item: ProjectQaRunItem, next: QaItemDraft) {
    const body = verificationPayload(item, next);
    if (!body) {
      closeDetails();
      return;
    }
    setSavingItemId(item.id);
    setError(null);
    try {
      const saved = await projectQaRunsRepository.setVerification(deliveryProjectId, run.id, item.id, body);
      if (saved) onRun(saved);
      else onReload();
      if (openItemId === item.id) closeDetails();
    } catch (cause) {
      setError({ itemId: item.id, ...qaActionError(cause, SAVE_ERROR) });
    } finally {
      setSavingItemId(null);
    }
  }

  function chooseStatus(item: ProjectQaRunItem, status: VerificationStatus) {
    // Never send a status this viewer cannot set, whatever the control offered.
    if (savingItemId || status === item.status || !allowedStatuses(item).includes(status)) return;
    if (statusNeedsSeverity(status)) {
      open(item, status);
      return;
    }
    void send(item, itemDraftFrom(item, status));
  }

  async function saveDraft(item: ProjectQaRunItem) {
    if (!draft || savingItemId || !canVerifyItem(item, run, permissions)) return;
    const status = draft.status;
    const allowed = status === item.status || allowedStatuses(item).some((entry) => entry === status);
    if (!allowed) return;
    setAttempted(true);
    if (itemDraftError(draft)) return;
    await send(item, draft);
  }

  return {
    status: savingItemId ? "saving" : "idle",
    savingItemId,
    openItemId,
    draft,
    draftError: attempted && draft ? itemDraftError(draft) : null,
    error,
    allowedStatuses,
    chooseStatus,
    openDetails: (item) => open(item),
    closeDetails,
    updateDraft: (patch) => setDraft((current) => (current ? { ...current, ...patch } : current)),
    saveDraft,
    dismissError: () => setError(null),
  };
}
