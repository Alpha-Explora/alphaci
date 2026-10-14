"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { attachmentKindLabel, evidenceAlt, positionLabel } from "../../model/qa-attachment-rules";
import type { QaAttachment } from "../../model/qa-attachment-types";
import { agoLabel } from "../../model/qa-run-rules";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "./evidence-icons";

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/** Keep Tab inside the dialog: from the last control back to the first, and the other way. */
function trapTab(event: KeyboardEvent<HTMLDivElement>) {
  const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === event.currentTarget)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/** Escape closes, the arrows step between images, Tab stays inside. */
function keyHandler(onClose: () => void, onStep: (delta: number) => void, many: boolean) {
  return (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      // Handled here: full screen must not also take this Escape.
      event.preventDefault();
      onClose();
    } else if (many && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      onStep(event.key === "ArrowLeft" ? -1 : 1);
    } else if (event.key === "Tab") {
      trapTab(event);
    }
  };
}

function Byline({ attachment }: Readonly<{ attachment: QaAttachment }>) {
  const ago = agoLabel(attachment.createdAt);
  if (!attachment.createdByLogin && !ago) return null;
  return (
    <p className="qa-lightbox__by">
      {attachment.createdByLogin ? (
        <>
          Added by <strong>@{attachment.createdByLogin}</strong>
        </>
      ) : (
        "Added"
      )}
      {ago ? ` · ${ago}` : ""}
    </p>
  );
}

/**
 * One screenshot at full size, over the page; the title says which kind it
 * is (QA evidence, Fix proof). A modal dialog drawn on
 * <body> (a full-screen studio's drawer would otherwise be its containing
 * block): focus moves to Close on open, stays inside while open (Tab wraps)
 * and returns to the thumbnail on close. Escape closes; the arrow keys step
 * between the item's screenshots.
 */
export function EvidenceLightbox({
  attachments,
  index,
  itemTitle,
  onClose,
  onStep,
  onImageError,
}: Readonly<{
  attachments: ReadonlyArray<QaAttachment>;
  index: number;
  itemTitle: string;
  onClose: () => void;
  onStep: (delta: number) => void;
  onImageError: () => void;
}>) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const attachment = attachments[index];
  const many = attachments.length > 1;

  useEffect(() => {
    const restore = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => restore?.focus?.();
  }, []);

  if (!attachment) return null;
  const alt = evidenceAlt(attachment, index, itemTitle);

  return createPortal(
    <div
      className="qa-lightbox"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="qa-lightbox__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={keyHandler(onClose, onStep, many)}
      >
        <div className="qa-lightbox__head">
          <h2 className="qa-lightbox__title" id={titleId}>
            {attachmentKindLabel(attachment.kind)} · {itemTitle}
          </h2>
          {many ? <span className="qa-lightbox__position">{positionLabel(index, attachments.length)}</span> : null}
          <button ref={closeRef} type="button" className="qa-lightbox__button" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <figure className="qa-lightbox__figure">
          <div className="qa-lightbox__stage">
            {many ? (
              <button
                type="button"
                className="qa-lightbox__button qa-lightbox__step"
                data-side="previous"
                aria-label="Previous screenshot"
                onClick={() => onStep(-1)}
              >
                <ChevronLeftIcon />
              </button>
            ) : null}
            {attachment.url ? (
              // A signed, short-lived URL from the backend: next/image cannot optimise it.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="qa-lightbox__image" src={attachment.url} alt={alt} onError={onImageError} />
            ) : (
              <p className="qa-lightbox__missing" role="status">
                Loading the screenshot…
              </p>
            )}
            {many ? (
              <button
                type="button"
                className="qa-lightbox__button qa-lightbox__step"
                data-side="next"
                aria-label="Next screenshot"
                onClick={() => onStep(1)}
              >
                <ChevronRightIcon />
              </button>
            ) : null}
          </div>
          <figcaption className="qa-lightbox__caption">
            {attachment.caption ? <p className="qa-lightbox__text">{attachment.caption}</p> : null}
            <Byline attachment={attachment} />
          </figcaption>
        </figure>
      </div>
    </div>,
    document.body,
  );
}
