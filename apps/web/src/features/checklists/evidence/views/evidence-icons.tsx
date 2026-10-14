/**
 * The screenshot glyphs, inline and decorative: every use sits beside text or
 * inside a control that carries its own label. Drawn on QA Studio's grid
 * (16 × 16, 1.6 stroke) so they sit beside the studio's own glyphs.
 */

import type { ReactNode } from "react";

function Glyph({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <svg
      aria-hidden="true"
      className="qa-glyph"
      fill="none"
      focusable="false"
      height={16}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 16 16"
      width={16}
    >
      {children}
    </svg>
  );
}

/** A camera: "Capture" the preview. */
export function CameraIcon() {
  return (
    <Glyph>
      <path d="M2.5 5.5h2.2l1.1-1.75h4.4l1.1 1.75h2.2v7h-11z" />
      <circle cx="8" cy="8.9" r="2.1" />
    </Glyph>
  );
}

/** An arrow into a tray: "Upload" a file. */
export function UploadIcon() {
  return (
    <Glyph>
      <path d="M8 10.5V2.75M5 5.5 8 2.5l3 3M2.75 10.5v2.75h10.5V10.5" />
    </Glyph>
  );
}

/** A picture: the Evidence heading. */
export function ImageIcon() {
  return (
    <Glyph>
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <circle cx="6" cy="6.5" r="1.1" />
      <path d="m3 12 3.5-3.5 2.25 2.25L10.5 9l2.75 2.75" />
    </Glyph>
  );
}

/** A wrench: the Developer's proof of a fix. */
export function WrenchIcon() {
  return (
    <Glyph>
      <path d="M10.6 2.6a3 3 0 0 0-3.7 3.9L2.75 10.65a1.3 1.3 0 0 0 1.85 1.85L8.75 8.35a3 3 0 0 0 3.9-3.7l-1.85 1.85-1.6-.35-.35-1.6z" />
    </Glyph>
  );
}

/** A bin: delete a screenshot. */
export function TrashIcon() {
  return (
    <Glyph>
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />
    </Glyph>
  );
}

/** Previous / next image in the lightbox. */
export function ChevronLeftIcon() {
  return (
    <Glyph>
      <path d="M10 3.5 5.5 8l4.5 4.5" />
    </Glyph>
  );
}

export function ChevronRightIcon() {
  return (
    <Glyph>
      <path d="M6 3.5 10.5 8 6 12.5" />
    </Glyph>
  );
}

/** Close the lightbox. */
export function CloseIcon() {
  return (
    <Glyph>
      <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
    </Glyph>
  );
}
