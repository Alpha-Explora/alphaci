"use client";

import "./qa-run-pills.css";

import {
  itemStatusLabel,
  itemStatusTone,
  severityLabel,
  verdictLabel,
  verdictTone,
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
