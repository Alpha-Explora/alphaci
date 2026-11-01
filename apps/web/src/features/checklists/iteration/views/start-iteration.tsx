"use client";

import "./iteration.css";

import { useId } from "react";

import { FormDialog } from "@/features/groups/workspace";
import type { AppRole } from "@/shared/api/contracts";

import { useCurrentIterationViewModel } from "../view-models/use-current-iteration-view-model";
import { useNextIterationViewModel } from "../view-models/use-next-iteration-view-model";
import { useStartIterationViewModel, type StartIterationViewModel } from "../view-models/use-start-iteration-view-model";
import { IterationStatusPill } from "./iteration-status";

/* "Start iteration N+1" with its dialog (a goal; the new iteration starts
 * with an empty checklist), and the sentence everyone else reads while the
 * Product owner has not started it yet (P15). Each renders nothing unless the
 * server said enough: an older backend's screens are exactly as before. */

/** An hourglass, decorative: it always sits beside the sentence it marks. */
function WaitGlyph() {
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
      <path d="M4 2h8M4 14h8M5 2c0 3 6 3 6 6s-6 3-6 6M11 2c0 3-6 3-6 6s6 3 6 6" />
    </svg>
  );
}

/** "Iteration 3 was delivered on 14 Oct 2026. Waiting for the Product owner to start iteration 4." */
export function IterationWaitingNotice({ text }: Readonly<{ text: string }>) {
  return (
    <div className="iteration-waiting" role="status">
      <WaitGlyph />
      <p className="iteration-waiting__text">{text}</p>
    </div>
  );
}

function GoalField({ vm }: Readonly<{ vm: StartIterationViewModel }>) {
  const errorId = useId();
  return (
    <label className="hier-field iteration-goal">
      <span className="hier-field-label">Goal (optional)</span>
      <input
        className="hier-input"
        type="text"
        value={vm.goal}
        maxLength={vm.goalMax}
        placeholder="Loyalty points"
        disabled={vm.submitting}
        aria-invalid={vm.goalError ? "true" : undefined}
        aria-describedby={vm.goalError ? errorId : undefined}
        data-autofocus
        onChange={(event) => vm.setGoal(event.target.value)}
      />
      <span className="iteration-goal__count" aria-hidden="true">
        {vm.goal.trim().length}/{vm.goalMax}
      </span>
      {vm.goalError ? (
        <span className="iteration-goal__error" id={errorId} role="alert">
          {vm.goalError}
        </span>
      ) : null}
    </label>
  );
}

/** The dialog: an optional goal. The new iteration starts with an empty checklist. */
export function StartIterationDialog({ vm }: Readonly<{ vm: StartIterationViewModel }>) {
  if (vm.step.kind !== "start") return null;
  return (
    <FormDialog
      open={vm.open}
      onClose={vm.close}
      portal
      title={vm.label}
      description={vm.description}
      submitLabel={vm.label}
      submitting={vm.submitting}
      error={vm.error}
      canSubmit={vm.goalError === null}
      onSubmit={() => void vm.submit()}
    >
      <div className="iteration-start">
        <GoalField vm={vm} />
      </div>
    </FormDialog>
  );
}

/** "Start iteration 4", and its dialog. Nothing unless this viewer is offered it. */
export function StartIterationAction({ vm }: Readonly<{ vm: StartIterationViewModel }>) {
  if (vm.step.kind !== "start") return null;
  return (
    <>
      <button type="button" className="primary-button iteration-start-button" onClick={vm.openDialog}>
        <span aria-hidden="true">+</span>
        {vm.label}
      </button>
      <StartIterationDialog vm={vm} />
    </>
  );
}

/**
 * Once the iteration is delivered: the waiting sentence for those who wait,
 * the delivered line with Start for a Product owner or admin, nothing
 * otherwise. For screens that carry the next step in their body (the QA run,
 * My QA items).
 */
export function IterationNextStepView({ vm }: Readonly<{ vm: StartIterationViewModel }>) {
  if (vm.step.kind === "waiting") return <IterationWaitingNotice text={vm.step.text} />;
  if (vm.step.kind !== "start") return null;
  return (
    <div className="iteration-next">
      <p className="iteration-next__text">{vm.step.text}</p>
      <StartIterationAction vm={vm} />
    </div>
  );
}

/** The next step for a screen that does not read the iteration itself. */
export function IterationNextStep({
  deliveryProjectId,
  enabled,
  appRole,
}: Readonly<{ deliveryProjectId: string | null; enabled: boolean; appRole: AppRole | null | undefined }>) {
  const vm = useNextIterationViewModel({ deliveryProjectId, enabled, appRole });
  return <IterationNextStepView vm={vm} />;
}

/**
 * The Project page's header: "Iteration 3 · Delivered 14 Oct" and, for a
 * Product owner or admin once it is delivered, Start iteration 4. One read
 * for both; nothing at all on a backend without iterations.
 */
export function IterationHeader({
  deliveryProjectId,
  enabled,
  appRole,
}: Readonly<{ deliveryProjectId: string | null; enabled: boolean; appRole: AppRole | null | undefined }>) {
  const iteration = useCurrentIterationViewModel({ deliveryProjectId, enabled });
  const start = useStartIterationViewModel({
    deliveryProjectId: deliveryProjectId ?? "",
    current: iteration.current,
    appRole,
  });
  if (iteration.status !== "ready" || !iteration.current) return null;
  return (
    <>
      <IterationStatusPill iteration={iteration.current.iteration} />
      <StartIterationAction vm={start} />
    </>
  );
}
