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

export function LinkIcon() {
  return (
    <Glyph>
      <path d="M6.75 9.25a2.5 2.5 0 0 0 3.54 0l2.5-2.5a2.5 2.5 0 0 0-3.54-3.54l-.7.7" />
      <path d="M9.25 6.75a2.5 2.5 0 0 0-3.54 0l-2.5 2.5a2.5 2.5 0 0 0 3.54 3.54l.7-.7" />
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

/** A test skipped: a short dash, quieter than a check or a cross. */
export function SkipIcon() {
  return (
    <Glyph>
      <path d="M4.75 8h6.5" />
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

export function ExportIcon() {
  return (
    <Glyph size={15}>
      <path d="M8 2.25v7.5M5 6.75l3 3 3-3" />
      <path d="M2.75 10.5v1.75c0 .83.67 1.5 1.5 1.5h7.5c.83 0 1.5-.67 1.5-1.5V10.5" />
    </Glyph>
  );
}

export function ChevronDownIcon() {
  return (
    <Glyph size={13}>
      <path d="m4.25 6.25 3.75 3.75 3.75-3.75" />
    </Glyph>
  );
}

export function DocumentIcon() {
  return (
    <Glyph>
      <path d="M9.25 1.75H4.5c-.69 0-1.25.56-1.25 1.25v10c0 .69.56 1.25 1.25 1.25h7c.69 0 1.25-.56 1.25-1.25V5.25L9.25 1.75Z" />
      <path d="M9.25 1.75v3.5h3.5M5.5 8.5h5M5.5 11h3.5" />
    </Glyph>
  );
}

export function CopyIcon() {
  return (
    <Glyph>
      <rect x="5.25" y="5.25" width="8.5" height="8.5" rx="1.4" />
      <path d="M10.75 5.25V3.5c0-.69-.56-1.25-1.25-1.25H3.5c-.69 0-1.25.56-1.25 1.25v6c0 .69.56 1.25 1.25 1.25h1.75" />
    </Glyph>
  );
}

export function BracesIcon() {
  return (
    <Glyph>
      <path d="M5.5 2.25c-1.25 0-1.75.6-1.75 1.75v2.2c0 .9-.55 1.55-1.5 1.8.95.25 1.5.9 1.5 1.8V12c0 1.15.5 1.75 1.75 1.75" />
      <path d="M10.5 2.25c1.25 0 1.75.6 1.75 1.75v2.2c0 .9.55 1.55 1.5 1.8-.95.25-1.5.9-1.5 1.8V12c0 1.15-.5 1.75-1.75 1.75" />
    </Glyph>
  );
}

export function PlayIcon() {
  return (
    <Glyph size={14}>
      <path d="M5 3.1v9.8a.6.6 0 0 0 .9.52l7.9-4.9a.6.6 0 0 0 0-1.03L5.9 2.58A.6.6 0 0 0 5 3.1Z" />
    </Glyph>
  );
}

export function FlaskIcon({ size = 16 }: Readonly<{ size?: number }>) {
  return (
    <Glyph size={size}>
      <path d="M6 1.75h4M6.75 1.75v4.5L2.9 12.6A1.1 1.1 0 0 0 3.85 14.25h8.3a1.1 1.1 0 0 0 .95-1.65L9.25 6.25v-4.5" />
      <path d="M4.6 10h6.8" />
    </Glyph>
  );
}

export function InfoIcon() {
  return (
    <Glyph size={13}>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 7.25v3.5M8 5.25v.01" />
    </Glyph>
  );
}

/** A device turning a quarter: rotate portrait ⇄ landscape. */
export function RotateIcon() {
  return (
    <Glyph>
      <rect x="2" y="6" width="8" height="8" rx="1.2" />
      <path d="M8 2.25h2.5a3.25 3.25 0 0 1 3.25 3.25V8" />
      <path d="M12 6.25 13.75 8l1.75-1.75" />
    </Glyph>
  );
}

export function ExpandIcon() {
  return (
    <Glyph>
      <path d="M2.25 6V2.25H6M10 2.25h3.75V6M13.75 10v3.75H10M6 13.75H2.25V10" />
    </Glyph>
  );
}

export function CollapseIcon() {
  return (
    <Glyph>
      <path d="M6 2.25V6H2.25M13.75 6H10V2.25M10 13.75V10h3.75M2.25 10H6v3.75" />
    </Glyph>
  );
}

/**
 * The run rail's pin: a window with its right column, filled while pinned —
 * the app's left rail toggle, mirrored to the side this rail is on.
 */
export function RailPinIcon({ pinned }: Readonly<{ pinned: boolean }>) {
  return (
    <Glyph>
      <rect x="1.75" y="2.5" width="12.5" height="11" rx="1.2" />
      <path d="M10.25 2.5v11" />
      {pinned ? <rect x="10.25" y="2.5" width="4" height="11" rx="1" fill="currentColor" stroke="none" opacity="0.35" /> : null}
    </Glyph>
  );
}

export function ChecklistIcon() {
  return (
    <Glyph>
      <path d="m2.25 4.25 1.25 1.25 2.25-2.5M2.25 10.25l1.25 1.25 2.25-2.5" />
      <path d="M8 4.5h5.75M8 10.5h5.75" />
    </Glyph>
  );
}

/** A git merge: two lines of history joining. "Merge to main". */
export function MergeIcon() {
  return (
    <Glyph>
      <circle cx="4.5" cy="3.5" r="1.5" />
      <circle cx="4.5" cy="12.5" r="1.5" />
      <circle cx="11.5" cy="9" r="1.5" />
      <path d="M4.5 5v6M4.5 5c0 2.4 2.3 4 5.5 4" />
    </Glyph>
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
