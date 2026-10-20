"use client";

import "./evidence.css";

import { useRef, type ClipboardEvent } from "react";

import type { ProjectQaRunItem } from "../../model/project-run-types";
import {
  evidenceAlt,
  evidenceCountLabel,
  MAX_CAPTION_LENGTH,
  MAX_EVIDENCE_PER_ITEM,
} from "../../model/qa-attachment-rules";
import type { QaAttachment } from "../../model/qa-attachment-types";
import { agoLabel } from "../../model/qa-run-rules";
import { usePreviewCaptureTarget } from "../view-models/preview-capture-target";
import { useItemEvidenceViewModel, type ItemEvidenceViewModel } from "../view-models/use-item-evidence-view-model";
import type { RunEvidenceViewModel } from "../view-models/use-run-evidence-view-model";
import { EvidenceLightbox } from "./evidence-lightbox";
import { CameraIcon, ImageIcon, TrashIcon, UploadIcon } from "./studio-icons";

const ACCEPT = "image/png,image/jpeg,image/webp";

const AT_LIMIT = `This item holds ${String(MAX_EVIDENCE_PER_ITEM)} screenshots, the most it can. Delete one to add another.`;

const CAPTURE_HINT =
  "Your browser asks which tab to share: pick this one. Only the preview is kept, and sharing stops at once.";

function Byline({ attachment }: Readonly<{ attachment: QaAttachment }>) {
  const ago = agoLabel(attachment.createdAt);
  const who = attachment.createdByLogin ? `@${attachment.createdByLogin}` : null;
  const text = [who, ago].filter(Boolean).join(" · ");
  return text ? <span className="qa-evidence__by">{text}</span> : null;
}

/** "Delete" asks first, inline: Delete / Keep, never a browser confirm. */
function DeleteControl({ vm, attachment }: Readonly<{ vm: ItemEvidenceViewModel; attachment: QaAttachment }>) {
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

function Thumbnails({ vm, item }: Readonly<{ vm: ItemEvidenceViewModel; item: ProjectQaRunItem }>) {
  if (!vm.attachments) {
    return vm.count > 0 ? (
      <div className="qa-evidence__thumbs" aria-hidden="true">
        {Array.from({ length: Math.min(vm.count, 5) }, (_, index) => (
          <span key={index} className="hier-skeleton qa-evidence__thumb-skeleton" />
        ))}
      </div>
    ) : null;
  }
  if (vm.attachments.length === 0) return null;
  return (
    <ul className="qa-evidence__thumbs">
      {vm.attachments.map((attachment, index) => {
        const alt = evidenceAlt(attachment, index, item.title);
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
function AddControls({ vm }: Readonly<{ vm: ItemEvidenceViewModel }>) {
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
function DraftComposer({ vm, item }: Readonly<{ vm: ItemEvidenceViewModel; item: ProjectQaRunItem }>) {
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
      <img className="qa-evidence__draft-image" src={draft.previewUrl} alt={`New screenshot of ${item.title}`} />
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

function EvidenceError({ vm }: Readonly<{ vm: ItemEvidenceViewModel }>) {
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

/** The read error of the run's whole list, shown once per item that has screenshots. */
function ListError({ evidence, count }: Readonly<{ evidence: RunEvidenceViewModel; count: number }>) {
  if (evidence.status !== "error" || count === 0) return null;
  return (
    <div className="qa-inline-alert" role="alert">
      <p>{evidence.error}</p>
      <button type="button" className="ghost-button" onClick={evidence.reload}>
        Try again
      </button>
    </div>
  );
}

function pasteHandler(vm: ItemEvidenceViewModel) {
  return (event: ClipboardEvent<HTMLElement>) => {
    const files = [...(event.clipboardData?.files ?? [])];
    if (vm.paste(files)) event.preventDefault();
  };
}

/** One line about the browser's share prompt, until the first capture. */
function CaptureHint({ vm }: Readonly<{ vm: ItemEvidenceViewModel }>) {
  if (!vm.canCapture || !vm.showCaptureHint || vm.draft) return null;
  return <p className="qa-evidence__hint">{CAPTURE_HINT}</p>;
}

function Lightbox({ vm, item }: Readonly<{ vm: ItemEvidenceViewModel; item: ProjectQaRunItem }>) {
  if (vm.lightboxIndex === null || !vm.attachments) return null;
  return (
    <EvidenceLightbox
      attachments={vm.attachments}
      index={vm.lightboxIndex}
      itemTitle={item.title}
      onClose={vm.closeLightbox}
      onStep={vm.step}
      onImageError={vm.imageFailed}
    />
  );
}

function EvidenceBody({
  vm,
  item,
  evidence,
}: Readonly<{ vm: ItemEvidenceViewModel; item: ProjectQaRunItem; evidence: RunEvidenceViewModel }>) {
  return (
    <section
      className="qa-evidence"
      aria-label={`Evidence for ${item.title}`}
      tabIndex={vm.canAdd ? 0 : undefined}
      onPaste={vm.canAdd ? pasteHandler(vm) : undefined}
    >
      <div className="qa-evidence__head">
        <span className="qa-evidence__label">
          <ImageIcon />
          Evidence
        </span>
        {vm.count > 0 ? (
          <span className="qa-evidence__count" aria-label={evidenceCountLabel(vm.count)}>
            {vm.count}
          </span>
        ) : null}
        {evidence.open ? null : <span className="qa-evidence__frozen">Frozen at sign-off</span>}
      </div>
      <Thumbnails vm={vm} item={item} />
      <ListError evidence={evidence} count={vm.count} />
      <AddControls vm={vm} />
      {vm.atLimit ? <p className="qa-evidence__hint">{AT_LIMIT}</p> : null}
      <CaptureHint vm={vm} />
      <DraftComposer vm={vm} item={item} />
      <EvidenceError vm={vm} />
      <Lightbox vm={vm} item={item} />
    </section>
  );
}

/**
 * One item's Evidence: its screenshots as thumbnails (click to enlarge), and
 * — for whoever the server lets add while the run is open — Capture (the QA
 * Studio preview), Paste and Upload. Hidden on a server without screenshots,
 * and when there is nothing to show and nothing this viewer may add.
 */
export function ItemEvidence({ item, evidence }: Readonly<{ item: ProjectQaRunItem; evidence: RunEvidenceViewModel }>) {
  const captureTarget = usePreviewCaptureTarget();
  const vm = useItemEvidenceViewModel({ item, evidence, captureTarget });
  if (evidence.status === "hidden") return null;
  if (!vm.canAdd && !vm.atLimit && vm.count === 0 && !vm.draft) return null;
  return <EvidenceBody vm={vm} item={item} evidence={evidence} />;
}
