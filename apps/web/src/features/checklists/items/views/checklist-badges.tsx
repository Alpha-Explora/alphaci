"use client";

import "./checklist-items.css";

import type {
  ChecklistTargetPersona,
  ChecklistVerificationType,
} from "../../model/checklist-types";
import {
  targetPersonaLabel,
  verificationTypeLabel,
} from "../../model/checklist-rules";

/**
 * Who an item is for. Colours follow the role badge in the sidebar — QA Team
 * is teal there and here — so a QA engineer recognises "theirs" without
 * reading the word.
 */
export function PersonaBadge({ persona }: Readonly<{ persona: ChecklistTargetPersona }>) {
  return (
    <span className={`qa-persona-badge qa-persona-badge--${persona}`}>
      {targetPersonaLabel(persona)}
    </span>
  );
}

/**
 * How an item is verified. Quieter than the persona badge on purpose: the
 * persona decides who acts, the verification type only says how.
 */
export function VerificationBadge({
  type,
}: Readonly<{ type: ChecklistVerificationType }>) {
  return (
    <span className={`qa-verify-chip qa-verify-chip--${type}`}>
      <span className="qa-verify-chip__dot" aria-hidden="true" />
      {verificationTypeLabel(type)}
    </span>
  );
}
