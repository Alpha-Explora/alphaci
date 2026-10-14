"use client";

import "./evidence.css";

import { useRef, type ClipboardEvent, type ReactNode } from "react";

import {
  evidenceAlt,
  evidenceCountLabel,
  MAX_CAPTION_LENGTH,
  MAX_EVIDENCE_PER_ITEM,
} from "../../model/qa-attachment-rules";
import type { QaAttachment } from "../../model/qa-attachment-types";
import { agoLabel } from "../../model/qa-run-rules";
import type { AttachmentGroupViewModel } from "../view-models/use-attachment-group-view-model";
import { EvidenceLightbox } from "./evidence-lightbox";
import { CameraIcon, ImageIcon, TrashIcon, UploadIcon } from "./evidence-icons";

const ACCEPT = "image/png,image/jpeg,image/webp";

const MOST = String(MAX_EVIDENCE_PER_ITEM);

const AT_LIMIT: Readonly<Record<AttachmentGroupViewModel["group"], string>> = {
  evidence: `This item holds ${MOST} screenshots, the most it can. Delete one to add another.`,
  fix_proof: `This item holds ${MOST} screenshots of the fix, the most it can. Delete one to add another.`,
};

const CAPTURE_HINT =
  "Your browser asks which tab to share: pick this one. Only the preview is kept, and sharing stops at once.";

function Byline({ attachment }: Readonly<{ attachment: QaAttachment }>) {
  const ago = agoLabel(attachment.createdAt);
  const who = attachment.createdByLogin ? `@${attachment.createdByLogin}` : null;
  const text = [who, ago].filter(Boolean).join(" · ");
  return text ? <span className="qa-evidence__by">{text}</span> : null;
}

/** "Delete" asks first, inline: Delete / Keep, never a browser confirm. */
function DeleteControl({ vm, attachment }: Readonly<{ vm: AttachmentGroupViewModel; attachment: QaAttachment }>) {
  if (!vm.canDelete(attachment)) return null;
  if (vm.confirmingDeleteId !== attachment.id) {
    return (
      <button
        type="button"
        className="qa-evidence__icon-button"
        aria-label={`Delete screenshot${attachment.caption ? `: ${attachment.caption}` : ""}`}
        title="Delete screenshot"
        disabled={vm.status === "saving" || vm.status === "deleting"}
        onClick={() => vm.askDelete(attachment.id)}
      >
        <TrashIcon />
      </button>
    );
  }
  const deleting = vm.status === "deleting";
  return (
    <span className="qa-evidence__confirm" role="group" aria-label="Delete this screenshot?">
      <span className="qa-evidence__confirm-text">Delete?</span>
      <button type="button" className="qa-evidence__chip qa-evidence__chip--danger" disabled={deleting} onClick={() => void vm.confirmDelete()}>
        {deleting ? "Deleting…" : "Delete"}
      </button>
      <button type="button" className="qa-evidence__chip" disabled={deleting} onClick={vm.cancelDelete}>
        Keep
      </button>
    </span>
  );
}

function Thumbnails({ vm, itemTitle }: Readonly<{ vm: AttachmentGroupViewModel; itemTitle: string }>) {
  if (!vm.attachments) {
    return vm.count > 0 ? (
      <div className="qa-evidence__thumbs" aria-hidden="true">
        {Array.from({ length: Math.min(vm.count, MAX_EVIDENCE_PER_ITEM) }, (_, index) => (
          <span key={index} className="hier-skeleton qa-evidence__thumb-skeleton" />
        ))}
      </div>
    ) : null;
  }
  if (vm.attachments.length === 0) return null;
  return (
    <ul className="qa-evidence__thumbs">
      {vm.attachments.map((attachment, index) => {
        const alt = evidenceAlt(attachment, index, itemTitle);
        return (
          <li key={attachment.id} className="qa-evidence__tile">
            <button
              type="button"
              className="qa-evidence__thumb"
              aria-label={`Open screenshot ${String(index + 1)}: ${alt}`}
              onClick={() => vm.openLightbox(index)}
            >
              {attachment.url ? (
                // A signed, short-lived URL from the backend: next/image cannot optimise it.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={attachment.url} alt={alt} loading="lazy" onError={vm.imageFailed} />
              ) : (
                <ImageIcon />
              )}
            </button>
            <div className="qa-evidence__meta">
              {attachment.caption ? <span className="qa-evidence__caption">{attachment.caption}</span> : null}
              <Byline attachment={attachment} />
            </div>
            <DeleteControl vm={vm} attachment={attachment} />
          </li>
        );
      })}
    </ul>
  );
}

/** Capture (QA Studio only), Upload, and the Paste shortcut. */
function AddControls({ vm }: Readonly<{ vm: AttachmentGroupViewModel }>) {
  const fileRef = useRef<HTMLInputElement>(null);
  if (!vm.canAdd || vm.draft) return null;
  const preparing = vm.status === "preparing";
  return (
    <div className="qa-evidence__add">
      {vm.canCapture ? (
        <button type="button" className="qa-evidence__action" disabled={preparing} onClick={() => void vm.capture()}>
          <CameraIcon />
          Capture
        </button>
      ) : null}
      <button type="button" className="qa-evidence__action" disabled={preparing} onClick={() => fileRef.current?.click()}>
        <UploadIcon />
        Upload
      </button>
      <input
        ref={fileRef}
        className="sr-only"
        type="file"
        accept={ACCEPT}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          vm.choose(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <span className="qa-evidence__paste">
        or paste <kbd>Ctrl/⌘ V</kbd>
      </span>
      {preparing ? (
        <span className="qa-evidence__pending" role="status">
          Preparing the screenshot…
        </span>
      ) : null}
    </div>
  );
}

/** The image waiting for its caption and Save. */
function DraftComposer({ vm, itemTitle }: Readonly<{ vm: AttachmentGroupViewModel; itemTitle: string }>) {
  const draft = vm.draft;
  if (!draft) return null;
  const saving = vm.status === "saving";
  return (
    <form
      className="qa-evidence__draft"
      onSubmit={(event) => {
        event.preventDefault();
        void vm.save();
      }}
      noValidate
    >
      {/* A local object URL of the compressed image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="qa-evidence__draft-image" src={draft.previewUrl} alt={`New screenshot of ${itemTitle}`} />
      <div className="qa-evidence__draft-fields">
        <label className="hier-field qa-editor-field">
          <span className="hier-field-label">Caption (optional)</span>
          <input
            className="hier-input"
            value={vm.caption}
            disabled={saving}
            maxLength={MAX_CAPTION_LENGTH}
            placeholder="What this shows"
            onChange={(event) => vm.setCaption(event.target.value)}
          />
        </label>
        <div className="qa-evidence__draft-actions">
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Saving…" : "Save screenshot"}
          </button>
          <button type="button" className="ghost-button" disabled={saving} onClick={vm.discard}>
            Discard
          </button>
          {saving ? (
            <span className="qa-evidence__pending" role="status">
              Uploading…
            </span>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function GroupError({ vm }: Readonly<{ vm: AttachmentGroupViewModel }>) {
  if (!vm.error) return null;
  return (
    <div className="qa-inline-alert" role="alert">
      <p>{vm.error}</p>
      <button type="button" className="qa-text-button" onClick={vm.dismissError}>
        Dismiss
      </button>
    </div>
  );
}

/** One line about the browser's share prompt, until the first capture. */
function CaptureHint({ vm }: Readonly<{ vm: AttachmentGroupViewModel }>) {
  if (!vm.canCapture || !vm.showCaptureHint || vm.draft) return null;
  return <p className="qa-evidence__hint">{CAPTURE_HINT}</p>;
}

function Lightbox({ vm, itemTitle }: Readonly<{ vm: AttachmentGroupViewModel; itemTitle: string }>) {
  if (vm.lightboxIndex === null || !vm.attachments) return null;
  return (
    <EvidenceLightbox
      attachments={vm.attachments}
      index={vm.lightboxIndex}
      itemTitle={itemTitle}
      onClose={vm.closeLightbox}
      onStep={vm.step}
      onImageError={vm.imageFailed}
    />
  );
}

/**
 * Ctrl/Cmd+V on the focused area that owns `vm`: an image becomes a draft
 * (and the browser's own paste is stopped); a text paste is left alone.
 */
export function evidencePasteHandler(vm: AttachmentGroupViewModel) {
  return (event: ClipboardEvent<HTMLElement>) => {
    const files = [...(event.clipboardData?.files ?? [])];
    if (vm.paste(files)) event.preventDefault();
  };
}

/** A group's count badge: "3", read as "3 screenshots". Nothing at zero. */
export function EvidenceCount({ count }: Readonly<{ count: number }>) {
  if (count === 0) return null;
  return (
    <span className="qa-evidence__count" aria-label={evidenceCountLabel(count)}>
      {count}
    </span>
  );
}

/**
 * One group's screenshots and controls, in the order A1 drew them:
 * thumbnails (click to enlarge, Delete where allowed), the list's read error,
 * Capture / Upload / Paste, the at-limit and share-prompt lines, the image
 * waiting for Save, this group's own error, and the lightbox. The caller owns
 * the frame (heading, paste target), so QA Studio and My QA items each keep
 * their own.
 */
export function EvidenceGroupBody({
  vm,
  itemTitle,
  listError = null,
}: Readonly<{ vm: AttachmentGroupViewModel; itemTitle: string; listError?: ReactNode }>) {
  return (
    <>
      <Thumbnails vm={vm} itemTitle={itemTitle} />
      {listError}
      <AddControls vm={vm} />
      {vm.atLimit ? <p className="qa-evidence__hint">{AT_LIMIT[vm.group]}</p> : null}
      <CaptureHint vm={vm} />
      <DraftComposer vm={vm} itemTitle={itemTitle} />
      <GroupError vm={vm} />
      <Lightbox vm={vm} itemTitle={itemTitle} />
    </>
  );
}
