/**
 * The studio's glyphs, inline: the app has no icon package, and a handful of
 * strokes do not justify one. Decorative only — every use sits beside text or
 * inside a control that carries its own label.
 */

import type { ReactNode } from "react";

function Glyph({ children, size = 16 }: Readonly<{ children: ReactNode; size?: number }>) {
  return (
    <svg
      aria-hidden="true"
      className="qa-glyph"
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 16 16"
      width={size}
    >
      {children}
    </svg>
  );
}

export function DesktopIcon() {
  return (
    <Glyph>
      <rect x="1.75" y="2.5" width="12.5" height="8.5" rx="1.2" />
      <path d="M6 13.75h4M8 11v2.75" />
    </Glyph>
  );
}

export function TabletIcon() {
  return (
    <Glyph>
      <rect x="3" y="1.75" width="10" height="12.5" rx="1.4" />
      <path d="M7.25 12h1.5" />
    </Glyph>
  );
}

export function MobileIcon() {
  return (
    <Glyph>
      <rect x="4.5" y="1.75" width="7" height="12.5" rx="1.4" />
      <path d="M7.4 12h1.2" />
    </Glyph>
  );
}

export function ReloadIcon() {
  return (
    <Glyph>
      <path d="M13.25 8a5.25 5.25 0 1 1-1.54-3.71" />
      <path d="M13.25 2.25v3h-3" />
    </Glyph>
  );
}

export function ExternalIcon() {
  return (
    <Glyph>
      <path d="M9.5 2.25h4.25V6.5M13.5 2.5 7.75 8.25" />
      <path d="M12 9.5v3.25a1 1 0 0 1-1 1H3.25a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1H6.5" />
    </Glyph>
  );
}

export function ArrowRightIcon() {
  return (
    <Glyph>
      <path d="M3 8h9.5M8.75 4.25 12.5 8l-3.75 3.75" />
    </Glyph>
  );
}

export function BranchIcon() {
  return (
    <Glyph>
      <circle cx="4.5" cy="3.5" r="1.5" />
      <circle cx="4.5" cy="12.5" r="1.5" />
      <circle cx="11.5" cy="4.5" r="1.5" />
      <path d="M4.5 5v6M11.5 6c0 2.5-2 3.25-4.5 3.5-1.4.15-2.5.6-2.5 1.5" />
    </Glyph>
  );
}

export function CheckIcon() {
  return (
    <Glyph>
      <path d="m3.5 8.25 3 3 6-6.5" />
    </Glyph>
  );
}

export function CrossIcon() {
  return (
    <Glyph>
      <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
    </Glyph>
  );
}

export function BlockedIcon() {
  return (
    <Glyph>
      <circle cx="8" cy="8" r="5.25" />
      <path d="m4.3 11.7 7.4-7.4" />
    </Glyph>
  );
}

export function ReturnIcon() {
  return (
    <Glyph>
      <path d="M6 3.25 2.75 6.5 6 9.75" />
      <path d="M2.75 6.5h6.5a3.25 3.25 0 0 1 0 6.5H7.5" />
    </Glyph>
  );
}

export function HistoryIcon() {
  return (
    <Glyph size={14}>
      <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9" />
      <path d="M2.5 2.75V5h2.25M8 5.25V8l2 1.25" />
    </Glyph>
  );
}

export function WarningIcon() {
  return (
    <Glyph size={14}>
      <path d="M8 2.25 14.25 13H1.75L8 2.25Z" />
      <path d="M8 6.5v3M8 11.25v.01" />
    </Glyph>
  );
}

export function SealIcon() {
  return (
    <Glyph size={18}>
      <path d="M8 1.75 9.6 3l2-.2.6 1.9 1.7 1.1-.6 1.9.6 1.9-1.7 1.1-.6 1.9-2-.2L8 13.75 6.4 12.4l-2 .2-.6-1.9-1.7-1.1.6-1.9-.6-1.9 1.7-1.1.6-1.9 2 .2L8 1.75Z" />
      <path d="m5.75 7.75 1.6 1.6 2.9-3.1" />
    </Glyph>
  );
}
