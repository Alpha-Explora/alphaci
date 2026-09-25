/**
 * The Pipeline runs tab's glyphs, inline: a handful of strokes do not justify
 * an icon package. Decorative only — every glyph sits beside text that says
 * the same thing, so colour and shape are never the only signal.
 */

import type { ReactNode } from "react";

import type { VerdictTone } from "../../model/pipeline-run-card-rules";

function Glyph({ children, size = 16 }: Readonly<{ children: ReactNode; size?: number }>) {
  return (
    <svg
      aria-hidden="true"
      className="pipe-glyph"
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 16 16"
      width={size}
    >
      {children}
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <Glyph size={14}>
      <path d="m4 6 4 4 4-4" />
    </Glyph>
  );
}

export function ExternalIcon() {
  return (
    <Glyph size={12}>
      <path d="M6 3.5H3.5v9h9V10M9 3.5h3.5V7M12.5 3.5 7 9" />
    </Glyph>
  );
}

export function PromoteIcon() {
  return (
    <Glyph size={14}>
      <circle cx="4" cy="4" r="1.6" />
      <circle cx="4" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <path d="M4 5.6v4.8M5.6 12h4.8M4 5.6c0 3.4 2.6 6.4 6.4 6.4" />
    </Glyph>
  );
}

export function InfoIcon() {
  return (
    <Glyph size={14}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 7.2v3.6M8 5.1v.1" />
    </Glyph>
  );
}

/** One glyph per verdict tone, so a stage reads without its colour. */
export function VerdictIcon({ tone }: Readonly<{ tone: VerdictTone }>) {
  switch (tone) {
    case "success":
      return (
        <Glyph size={14}>
          <path d="m3.5 8.4 2.9 2.8 6.1-6.4" />
        </Glyph>
      );
    case "danger":
      return (
        <Glyph size={14}>
          <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
        </Glyph>
      );
    case "warning":
      return (
        <Glyph size={14}>
          <path d="M8 4v4.6M8 11.4v.1" />
        </Glyph>
      );
    case "running":
      return (
        <Glyph size={14}>
          <circle cx="8" cy="8" r="2.4" fill="currentColor" stroke="none" />
        </Glyph>
      );
    default:
      return (
        <Glyph size={14}>
          <path d="M4.8 8h6.4" />
        </Glyph>
      );
  }
}
