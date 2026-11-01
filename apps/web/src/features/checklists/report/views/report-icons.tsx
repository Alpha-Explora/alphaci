/**
 * The report page's glyphs, inline (the app has no icon package). Decorative
 * only — every use sits beside text that carries the meaning.
 */

import type { ReactNode } from "react";

function Glyph({ children, size = 16 }: Readonly<{ children: ReactNode; size?: number }>) {
  return (
    <svg
      aria-hidden="true"
      className="qa-report-glyph"
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

export function ArrowLeftIcon() {
  return (
    <Glyph size={15}>
      <path d="M12.75 8H3.5M7.25 4.25 3.5 8l3.75 3.75" />
    </Glyph>
  );
}

export function PrinterIcon() {
  return (
    <Glyph size={15}>
      <path d="M4.25 5.75V2.25h7.5v3.5" />
      <path d="M4.25 11.5h-1c-.69 0-1.25-.56-1.25-1.25V7c0-.69.56-1.25 1.25-1.25h9.5c.69 0 1.25.56 1.25 1.25v3.25c0 .69-.56 1.25-1.25 1.25h-1" />
      <path d="M4.25 9.5h7.5v4.25h-7.5z" />
    </Glyph>
  );
}

export function LockIcon() {
  return (
    <Glyph size={14}>
      <rect x="3.25" y="7" width="9.5" height="6.75" rx="1.3" />
      <path d="M5.25 7V5.25a2.75 2.75 0 0 1 5.5 0V7" />
    </Glyph>
  );
}

export function PulseIcon() {
  return (
    <Glyph size={14}>
      <path d="M1.75 8h2.5l1.5-3.5 2.5 7 1.75-5 1 1.5h3.25" />
    </Glyph>
  );
}
