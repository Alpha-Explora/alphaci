"use client";

import "./iteration.css";

import { iterationLockedText, iterationStatusLabel } from "../../model/iteration-rules";
import type { ProjectIteration } from "../../model/iteration-types";
import { useCurrentIterationViewModel } from "../view-models/use-current-iteration-view-model";

/** A padlock, decorative: it always sits beside the sentence it marks. */
function LockGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="iteration-glyph"
      fill="none"
      focusable="false"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 16 16"
      width="14"
    >
      <rect x="3" y="7" width="10" height="7" rx="1.4" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

/** "Iteration 3 · Active" or "Iteration 3 · Delivered 14 Oct", as a small pill. */
export function IterationStatusPill({
  iteration,
  locale,
}: Readonly<{ iteration: Pick<ProjectIteration, "number" | "status" | "deliveredAt">; locale?: string }>) {
  return (
    <span className="iteration-status" data-status={iteration.status}>
      <span className="iteration-status__dot" aria-hidden="true" />
      {iterationStatusLabel(iteration, locale)}
    </span>
  );
}

/**
 * The Project header's iteration status. It reads the Project's current
 * iteration itself; while that is loading, or when the backend has no
 * iterations (404) or answers without one, it renders nothing at all, so the
 * header is exactly what it was before iterations existed.
 */
export function IterationStatus({
  deliveryProjectId,
  enabled,
}: Readonly<{ deliveryProjectId: string | null; enabled: boolean }>) {
  const vm = useCurrentIterationViewModel({ deliveryProjectId, enabled });
  if (vm.status !== "ready" || !vm.current) return null;
  return <IterationStatusPill iteration={vm.current.iteration} />;
}

/**
 * The read-only banner on a delivered iteration's QA run and requirements:
 * "Iteration 3 was delivered. Changes are locked." The controls themselves
 * are withheld by their screens; this says why.
 */
export function IterationLockedNotice({ number }: Readonly<{ number: number }>) {
  return (
    <div className="iteration-locked" role="status">
      <LockGlyph />
      <p className="iteration-locked__text">{iterationLockedText(number)}</p>
    </div>
  );
}
