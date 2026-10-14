"use client";

import { useEffect, useRef, useState } from "react";

import { captureElement, imageFromFile, supportsScreenCapture } from "../../data/evidence-capture-repository";
import { qaAttachmentsRepository } from "../../data/qa-attachments-repository";
import { evidenceFileName, firstImageIndex } from "../../model/evidence-image-rules";
import type { ProjectQaRunItem } from "../../model/project-run-types";
import {
  attachmentErrorMessage,
  canDeleteEvidence,
  captionError,
  captionPayload,
  captureErrorMessage,
  evidenceAtLimit,
  evidenceCount,
  stepIndex,
} from "../../model/qa-attachment-rules";
import type { EvidenceImage, EvidenceUploadInput, QaAttachment } from "../../model/qa-attachment-types";
import { errorCode } from "../../model/wire-readers";
import type { PreviewCaptureTarget } from "./preview-capture-target";
import { useRememberedFlag } from "./use-remembered-flag";
import type { RunEvidenceViewModel } from "./use-run-evidence-view-model";

/**
 * `preparing` while an image is captured, decoded and compressed; `draft`
 * once it waits for its caption and Save; `saving` / `deleting` while the
 * write is in flight.
 */
export type ItemEvidenceStatus = "idle" | "preparing" | "draft" | "saving" | "deleting";

export type EvidenceSource = EvidenceUploadInput["source"];

export interface EvidenceDraft {
  image: EvidenceImage;
  /** An object URL for the preview; revoked when the draft goes. */
  previewUrl: string;
  source: EvidenceSource;
}

export interface ItemEvidenceViewModel {
  status: ItemEvidenceStatus;
  /** This item's screenshots, oldest first; undefined while the run's list is read. */
  attachments: QaAttachment[] | undefined;
  /** What the badge says before (and after) the list is read. */
  count: number;
  /** Capture, Paste and Upload are offered (the run is open, the server allows it, the item is not full). */
  canAdd: boolean;
  /** This viewer could add, but the item already holds the most it can. */
  atLimit: boolean;
  /** Only where the browser can share a tab and QA Studio's preview is on the page. */
  canCapture: boolean;
  /** The one line about the browser's prompt, until the first capture. */
  showCaptureHint: boolean;
  draft: EvidenceDraft | null;
  caption: string;
  /** Safe to render. */
  error: string | null;
  /** The attachment whose delete waits for "Delete" / "Keep". */
  confirmingDeleteId: string | null;
  /** The image open in the lightbox, or null. */
  lightboxIndex: number | null;
  canDelete: (attachment: QaAttachment) => boolean;
  capture: () => Promise<void>;
  /** A paste: true when it held an image (the caller then stops the browser's own paste). */
  paste: (files: ReadonlyArray<File>) => boolean;
  choose: (file: File | null | undefined) => void;
  setCaption: (caption: string) => void;
  save: () => Promise<void>;
  discard: () => void;
  askDelete: (attachmentId: string) => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  openLightbox: (index: number) => void;
  closeLightbox: () => void;
  step: (delta: number) => void;
  /** An image did not load: its signed URL may have run out. */
  imageFailed: () => void;
  dismissError: () => void;
}

const PREPARE_ERROR = "The image could not be read. Try another screenshot.";
const SAVE_ERROR = "The screenshot could not be saved. Try again in a moment.";
const DELETE_ERROR = "The screenshot could not be deleted. Try again in a moment.";

/** Codes after which the run's own list is out of date (someone else added, or the run froze). */
const RELOAD_CODES: ReadonlySet<string> = new Set(["QA_ATTACHMENT_LIMIT", "QA_RUN_SIGNED_OFF"]);

/** The draft's preview URL, revoked whenever the draft is replaced or the item unmounts. */
function useDraft(): [EvidenceDraft | null, (next: EvidenceDraft | null) => void] {
  const [draft, setDraftState] = useState<EvidenceDraft | null>(null);
  const current = useRef<EvidenceDraft | null>(null);
  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current.previewUrl);
    },
    [],
  );
  function setDraft(next: EvidenceDraft | null) {
    if (current.current && current.current !== next) URL.revokeObjectURL(current.current.previewUrl);
    current.current = next;
    setDraftState(next);
  }
  return [draft, setDraft];
}

function isBusy(status: ItemEvidenceStatus): boolean {
  return status === "preparing" || status === "saving" || status === "deleting";
}

/** The lightbox's image, while it still exists (a delete can remove the last one). */
function shownIndex(index: number | null, length: number): number | null {
  return index !== null && index < length ? index : null;
}

/**
 * ViewModel for one item's Evidence: the three ways in (Capture the QA Studio
 * preview, Paste from the clipboard, Upload a file), each compressed in the
 * browser before an optional caption and Save; inline delete confirmation;
 * and the lightbox's position. Every right comes from the server: the run's
 * `attachments.canAdd` and each attachment's `canDelete`, both off once the
 * run is signed off.
 */
export function useItemEvidenceViewModel(options: {
  item: ProjectQaRunItem;
  evidence: RunEvidenceViewModel;
  captureTarget: PreviewCaptureTarget | null;
}): ItemEvidenceViewModel {
  const { item, evidence, captureTarget } = options;
  const attachments = evidence.forItem(item.id);
  const count = evidenceCount(attachments, item.attachmentCount);
  const [status, setStatus] = useState<ItemEvidenceStatus>("idle");
  const [draft, setDraft] = useDraft();
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [hintSeen, toggleHintSeen] = useRememberedFlag("alphaci.qa.evidence.capture-hint-seen", false);
  const canAdd = evidence.canAdd && !evidenceAtLimit(count);
  const busy = isBusy(status);

  function adopt(image: EvidenceImage, source: EvidenceSource) {
    setDraft({ image, previewUrl: URL.createObjectURL(image.blob), source });
    setStatus("draft");
  }

  function failPreparing(message: string | null) {
    setError(message);
    setStatus(draft ? "draft" : "idle");
  }

  async function prepare(file: Blob, source: EvidenceSource) {
    if (!canAdd || busy) return;
    setStatus("preparing");
    setError(null);
    try {
      adopt(await imageFromFile(file), source);
    } catch (cause) {
      failPreparing(attachmentErrorMessage(cause, PREPARE_ERROR));
    }
  }

  async function capture() {
    const frame = captureTarget?.current;
    if (!frame || !canAdd || busy) return;
    if (!hintSeen) toggleHintSeen();
    setStatus("preparing");
    setError(null);
    try {
      adopt(await captureElement(frame), "capture");
    } catch (cause) {
      failPreparing(captureErrorMessage(cause));
    }
  }

  function clearDraft() {
    setDraft(null);
    setCaption("");
    setStatus("idle");
  }

  async function save() {
    if (!draft || status !== "draft") return;
    const invalid = captionError(caption);
    if (invalid) {
      setError(invalid);
      return;
    }
    setStatus("saving");
    setError(null);
    try {
      const saved = await qaAttachmentsRepository.upload(evidence.deliveryProjectId, evidence.runId, item.id, {
        file: draft.image.blob,
        fileName: evidenceFileName(draft.image.type, new Date()),
        caption: captionPayload(caption),
        source: draft.source,
      });
      evidence.added(saved);
      clearDraft();
    } catch (cause) {
      setError(attachmentErrorMessage(cause, SAVE_ERROR));
      setStatus("draft");
      if (RELOAD_CODES.has(errorCode(cause))) evidence.reload();
    }
  }

  async function confirmDelete() {
    const id = confirmingDeleteId;
    if (!id || busy) return;
    setStatus("deleting");
    setError(null);
    try {
      await qaAttachmentsRepository.remove(evidence.deliveryProjectId, evidence.runId, id);
      evidence.removed(id);
      setLightboxIndex(null);
    } catch (cause) {
      setError(attachmentErrorMessage(cause, DELETE_ERROR));
      if (RELOAD_CODES.has(errorCode(cause))) evidence.reload();
    } finally {
      setConfirmingDeleteId(null);
      setStatus(draft ? "draft" : "idle");
    }
  }

  const length = attachments?.length ?? 0;

  return {
    status,
    attachments,
    count,
    canAdd,
    atLimit: evidence.canAdd && evidenceAtLimit(count),
    canCapture: canAdd && captureTarget !== null && supportsScreenCapture(),
    showCaptureHint: !hintSeen,
    draft,
    caption,
    error,
    confirmingDeleteId,
    lightboxIndex: shownIndex(lightboxIndex, length),
    canDelete: (attachment) => canDeleteEvidence(attachment, { status: evidence.open ? "open" : "signed_off" }),
    capture,
    paste: (files) => {
      const index = firstImageIndex(files.map((file) => file.type));
      if (index < 0 || !canAdd) return false;
      void prepare(files[index], "paste");
      return true;
    },
    choose: (file) => {
      if (file) void prepare(file, "upload");
    },
    setCaption,
    save,
    discard: () => {
      clearDraft();
      setError(null);
    },
    askDelete: (attachmentId) => {
      setError(null);
      setConfirmingDeleteId(attachmentId);
    },
    cancelDelete: () => setConfirmingDeleteId(null),
    confirmDelete,
    openLightbox: (index) => {
      evidence.refreshIfExpired();
      setLightboxIndex(index);
    },
    closeLightbox: () => setLightboxIndex(null),
    step: (delta) => setLightboxIndex((current) => (current === null ? current : stepIndex(current, delta, length))),
    imageFailed: evidence.refreshIfExpired,
    dismissError: () => setError(null),
  };
}
