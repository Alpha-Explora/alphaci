"use client";

import "./qa-run-pills.css";

import {
  UNCONFIRMED_PASS_HINT,
  automatedBadgeLabel,
  automatedStatusTone,
  isUnconfirmedPass,
} from "../../model/qa-automation-rules";
import type { QaAutomatedStatus } from "../../model/qa-automation-types";
import {
  itemStatusLabel,
  itemStatusTone,
  severityLabel,
  verdictLabel,
  verdictTone,
  type QaTone,
} from "../../model/qa-run-rules";
import type {
  QaDefectSeverity,
  QaRunItemStatus,
  QaVerdict,
} from "../../model/qa-run-types";

/**
 * An item's status in words and colour. The colour follows the app's semantic
 * tokens — success for passed, danger for failed and blocked, warning for
 * returned — so colour is never the only signal. Shared by the studio and the
 * Overview's "Returned by QA" card, so a status reads the same in both.
 */
export function StatusPill({ status }: Readonly<{ status: QaRunItemStatus }>) {
  return (
    <span className={`qa-pill qa-pill--${itemStatusTone(status)}`}>
      <span className="qa-pill__dot" aria-hidden="true" />
      {itemStatusLabel(status)}
    </span>
  );
}

/** How bad a defect is. Blocker reads as danger; major and minor step down. */
export function SeverityBadge({ severity }: Readonly<{ severity: QaDefectSeverity }>) {
  return (
    <span className={`qa-severity qa-severity--${severity}`}>
      <span className="sr-only">Severity: </span>
      {severityLabel(severity)}
    </span>
  );
}

export function VerdictPill({ verdict }: Readonly<{ verdict: QaVerdict }>) {
  return (
    <span className={`qa-pill qa-pill--${verdictTone(verdict)}`}>
      <span className="qa-pill__dot" aria-hidden="true" />
      {verdictLabel(verdict)}
    </span>
  );
}

/** Any label in a status tone — for states that are not an item's status (a CI stage's result). */
export function TonePill({ tone, label }: Readonly<{ tone: QaTone; label: string }>) {
  return (
    <span className={`qa-pill qa-pill--${tone}`}>
      <span className="qa-pill__dot" aria-hidden="true" />
      {label}
    </span>
  );
}

/** A lab flask: "a machine checked this". Decorative; the badge says it in words. */
function FlaskGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="qa-auto-badge__glyph"
      fill="none"
      focusable="false"
      height="12"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 16 16"
      width="12"
    >
      <path d="M6 1.75h4M6.75 1.75v4.5L2.9 12.6A1.1 1.1 0 0 0 3.85 14.25h8.3a1.1 1.1 0 0 0 .95-1.65L9.25 6.25v-4.5" />
      <path d="M4.6 10h6.8" />
    </svg>
  );
}

/**
 * What CI concluded for an item — deliberately NOT a status pill: square
 * corners, an outline instead of a fill, and a flask, so it never reads as the
 * tester's recorded status beside it. Shared by QA Studio and the report.
 *
 * A pass an older pipeline never confirmed (`inferred`) is softer — muted
 * rather than green, "Passed (not confirmed)", and a tooltip saying why — so
 * it is not mistaken for a test that was seen passing.
 */
export function AutomatedBadge({
  status,
  inferred = false,
}: Readonly<{ status: QaAutomatedStatus; inferred?: boolean }>) {
  const unconfirmed = isUnconfirmedPass({ status, inferred });
  return (
    <span
      className={`qa-auto-badge qa-auto-badge--${automatedStatusTone(status)}${unconfirmed ? " qa-auto-badge--unconfirmed" : ""}`}
      title={unconfirmed ? UNCONFIRMED_PASS_HINT : undefined}
    >
      <FlaskGlyph />
      <span className="qa-auto-badge__label">Automated</span>
      <span className="qa-auto-badge__status">{automatedBadgeLabel(status, inferred)}</span>
    </span>
  );
}
