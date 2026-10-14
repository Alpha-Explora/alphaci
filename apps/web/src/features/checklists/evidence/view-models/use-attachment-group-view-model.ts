"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { captureElement, imageFromFile, supportsScreenCapture } from "../../data/evidence-capture-repository";
import { qaAttachmentsRepository } from "../../data/qa-attachments-repository";
import { evidenceFileName, firstImageIndex } from "../../model/evidence-image-rules";
import {
  attachmentErrorMessage,
  attachmentsInGroup,
  canDeleteEvidence,
  captionError,
  captionPayload,
  captureErrorMessage,
  evidenceAtLimit,
  evidenceCount,
  stepIndex,
} from "../../model/qa-attachment-rules";
import type {
  EvidenceImage,
  EvidenceUploadInput,
  QaAttachment,
  QaAttachmentGroup,
} from "../../model/qa-attachment-types";
import { errorCode } from "../../model/wire-readers";

/**
 * `preparing` while an image is captured, decoded and compressed; `draft`
 * once it waits for its caption and Save; `saving` / `deleting` while the
 * write is in flight.
 */
export type AttachmentGroupStatus = "idle" | "preparing" | "draft" | "saving" | "deleting";

export type EvidenceSource = EvidenceUploadInput["source"];

export interface EvidenceDraft {
  image: EvidenceImage;
  /** An object URL for the preview; revoked when the draft goes. */
  previewUrl: string;
  source: EvidenceSource;
}

/**
 * Where a group's screenshots are read from and written to: the whole run's
 * list in QA Studio, or one item's list in My QA items. Either way the list
 * holds every kind; the group keeps its own.
 */
export interface AttachmentSource {
  deliveryProjectId: string;
  runId: string;
  /** False on a signed-off run: no add, no delete. */
  open: boolean;
  /** One item's loaded screenshots (every kind); undefined until the list is read. */
  forItem: (itemId: string) => QaAttachment[] | undefined;
  /** Read the list again (signed URLs last five minutes; a refusal can mean it is out of date). */
  reload: () => void;
  /** Read it again only when a URL has expired or is about to. */
  refreshIfExpired: () => void;
  added: (attachment: QaAttachment) => void;
  removed: (attachmentId: string) => void;
}

/** "Capture" crops to QA Studio's preview; outside QA Studio there is none. */
export interface CaptureOption {
  target: RefObject<HTMLIFrameElement | null>;
  /** The viewer has seen the one line about the browser's share prompt. */
  hintSeen: boolean;
  markHintSeen: () => void;
}

export interface AttachmentGroupViewModel {
  status: AttachmentGroupStatus;
  /** Which kind this group shows and adds. */
  group: QaAttachmentGroup;
  /** This group's screenshots, oldest first; undefined while the list is read. */
  attachments: QaAttachment[] | undefined;
  /** What the badge says before (and after) the list is read. */
  count: number;
  /** Capture, Paste and Upload are offered (the viewer may add, and the group is not full). */
  canAdd: boolean;
  /** This viewer could add, but the group already holds the most it can. */
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

/** Codes after which the list (or the item's state) is out of date: someone else added, the run froze, or QA moved the item. */
const RELOAD_CODES: ReadonlySet<string> = new Set([
  "QA_ATTACHMENT_LIMIT",
  "QA_RUN_SIGNED_OFF",
  "QA_FIX_PROOF_NOT_REQUESTED",
]);

/** The draft's preview URL, revoked whenever the draft is replaced or the group unmounts. */
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

function isBusy(status: AttachmentGroupStatus): boolean {
  return status === "preparing" || status === "saving" || status === "deleting";
}

/** The lightbox's image, while it still exists (a delete can remove the last one). */
function shownIndex(index: number | null, length: number): number | null {
  return index !== null && index < length ? index : null;
}

/** One group's screenshots out of the item's loaded list; undefined while it is read. */
function groupList(all: QaAttachment[] | undefined, group: QaAttachmentGroup): QaAttachment[] | undefined {
  return all ? attachmentsInGroup(all, group) : undefined;
}

/**
 * ViewModel for one group of an item's screenshots (QA's evidence, or a
 * Developer's proof of a fix): the ways in (Capture the QA Studio preview
 * where offered, Paste from the clipboard, Upload a file), each compressed in
 * the browser before an optional caption and Save; inline delete
 * confirmation; and the lightbox's position. Uploads go to the run item at
 * once, as `group`'s kind. Every right comes from the server: `mayAdd` (the
 * run's or the item's flag) and each attachment's `canDelete`, both off once
 * the run is signed off.
 */
export function useAttachmentGroupViewModel(options: {
  itemId: string;
  group: QaAttachmentGroup;
  source: AttachmentSource;
  /** The run payload's count for this group; null when the server sent none. */
  countFromRun: number | null;
  /** The server lets this viewer add this kind to this item now. */
  mayAdd: boolean;
  capture: CaptureOption | null;
}): AttachmentGroupViewModel {
  const { itemId, group, source, countFromRun, mayAdd, capture } = options;
  const attachments = groupList(source.forItem(itemId), group);
  const count = evidenceCount(attachments, countFromRun);
  const [status, setStatus] = useState<AttachmentGroupStatus>("idle");
  const [draft, setDraft] = useDraft();
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const canAdd = mayAdd && !evidenceAtLimit(count);
  const busy = isBusy(status);

  function adopt(image: EvidenceImage, from: EvidenceSource) {
    setDraft({ image, previewUrl: URL.createObjectURL(image.blob), source: from });
    setStatus("draft");
  }

  function failPreparing(message: string | null) {
    setError(message);
    setStatus(draft ? "draft" : "idle");
  }

  async function prepare(file: Blob, from: EvidenceSource) {
    if (!canAdd || busy) return;
    setStatus("preparing");
    setError(null);
    try {
      adopt(await imageFromFile(file), from);
    } catch (cause) {
      failPreparing(attachmentErrorMessage(cause, PREPARE_ERROR, group));
    }
  }

  async function captureFrame() {
    const frame = capture?.target.current;
    if (!capture || !frame || !canAdd || busy) return;
    if (!capture.hintSeen) capture.markHintSeen();
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
      const saved = await qaAttachmentsRepository.upload(source.deliveryProjectId, source.runId, itemId, {
        file: draft.image.blob,
        fileName: evidenceFileName(draft.image.type, new Date()),
        caption: captionPayload(caption),
        source: draft.source,
        kind: group,
      });
      source.added(saved);
      clearDraft();
    } catch (cause) {
      setError(attachmentErrorMessage(cause, SAVE_ERROR, group));
      setStatus("draft");
      if (RELOAD_CODES.has(errorCode(cause))) source.reload();
    }
  }

  async function confirmDelete() {
    const id = confirmingDeleteId;
    if (!id || busy) return;
    setStatus("deleting");
    setError(null);
    try {
      await qaAttachmentsRepository.remove(source.deliveryProjectId, source.runId, id);
      source.removed(id);
      setLightboxIndex(null);
    } catch (cause) {
      setError(attachmentErrorMessage(cause, DELETE_ERROR, group));
      if (RELOAD_CODES.has(errorCode(cause))) source.reload();
    } finally {
      setConfirmingDeleteId(null);
      setStatus(draft ? "draft" : "idle");
    }
  }

  const length = attachments?.length ?? 0;

  return {
    status,
    group,
    attachments,
    count,
    canAdd,
    atLimit: mayAdd && evidenceAtLimit(count),
    canCapture: canAdd && capture !== null && supportsScreenCapture(),
    showCaptureHint: capture !== null && !capture.hintSeen,
    draft,
    caption,
    error,
    confirmingDeleteId,
    lightboxIndex: shownIndex(lightboxIndex, length),
    canDelete: (attachment) => canDeleteEvidence(attachment, { status: source.open ? "open" : "signed_off" }),
    capture: captureFrame,
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
      source.refreshIfExpired();
      setLightboxIndex(index);
    },
    closeLightbox: () => setLightboxIndex(null),
    step: (delta) => setLightboxIndex((current) => (current === null ? current : stepIndex(current, delta, length))),
    imageFailed: source.refreshIfExpired,
    dismissError: () => setError(null),
  };
}
