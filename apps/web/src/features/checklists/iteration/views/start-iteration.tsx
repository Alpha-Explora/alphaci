"use client";

import "./iteration.css";

import { useId } from "react";

import { FormDialog } from "@/features/groups/workspace";
import type { AppRole } from "@/shared/api/contracts";

import type { CarryOverGroup } from "../../model/iteration-carry-over-rules";
import { useCurrentIterationViewModel } from "../view-models/use-current-iteration-view-model";
import { useNextIterationViewModel } from "../view-models/use-next-iteration-view-model";
import { useStartIterationViewModel, type StartIterationViewModel } from "../view-models/use-start-iteration-view-model";
import { IterationStatusPill } from "./iteration-status";

/* Iterations phase 3: "Start iteration N+1" with its carry-over dialog, and
 * the sentence everyone else reads while the Product owner has not started
 * it yet (P15). Each renders nothing unless the server said enough: an older
 * backend's screens are exactly as before. */

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

function CarryGroup({ group, vm }: Readonly<{ group: CarryOverGroup; vm: StartIterationViewModel }>) {
  return (
    <li className="iteration-carry__group">
      <p className="iteration-carry__requirement">
        <span className="iteration-carry__kind" data-kind={group.kind}>
          {group.kindLabel}
        </span>
        <span className="iteration-carry__name">{group.name}</span>
      </p>
      <ul className="iteration-carry__items" aria-label={`${group.kindLabel}: ${group.name}`}>
        {group.items.map((item) => (
          <li key={item.id} className="iteration-carry__item" data-suggested={item.suggested ? "true" : undefined}>
            <label className="iteration-carry__label">
              <input
                type="checkbox"
                className="iteration-carry__check"
                checked={item.checked}
                disabled={vm.submitting}
                onChange={() => vm.toggleItem(item.id)}
              />
              <span className="iteration-carry__copy">
                <span className="iteration-carry__title">{item.title}</span>
                <span className="iteration-carry__hint">{item.hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </li>
  );
}

function CarryOverList({ vm }: Readonly<{ vm: StartIterationViewModel }>) {
  const from = vm.fromIterationNumber;
  const nextName = vm.step.kind === "start" ? `iteration ${String(vm.step.nextNumber)}` : "the next iteration";
  return (
    <fieldset className="hier-field iteration-carry">
      <legend className="hier-field-label">Carry over{from ? ` from Iteration ${String(from)}` : ""}</legend>
      {vm.groups.length === 0 ? (
        <p className="iteration-carry__empty">Nothing to carry over: {nextName} starts empty.</p>
      ) : (
        <>
          <div className="iteration-carry__bar">
            <span className="iteration-carry__count" aria-live="polite">
              {vm.selectionLabel}
            </span>
            <button
              type="button"
              className="iteration-carry__action"
              disabled={vm.submitting || vm.unfinishedCount === 0}
              onClick={vm.selectAllUnfinished}
            >
              Select all unfinished
            </button>
            <button
              type="button"
              className="iteration-carry__action"
              disabled={vm.submitting || vm.selectedCount === 0}
              onClick={vm.clear}
            >
              Clear
            </button>
          </div>
          <ul className="iteration-carry__groups">
            {vm.groups.map((group) => (
              <CarryGroup key={group.requirementId} group={group} vm={vm} />
            ))}
          </ul>
        </>
      )}
    </fieldset>
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

/** The dialog: an optional goal, and the delivered iteration's items with the unfinished ones pre-checked. */
export function StartIterationDialog({ vm }: Readonly<{ vm: StartIterationViewModel }>) {
  if (vm.step.kind !== "start") return null;
  const from = vm.fromIterationNumber;
  return (
    <FormDialog
      open={vm.open}
      onClose={vm.close}
      title={vm.label}
      description={`Name what this iteration is for, and choose the work to bring along. Unfinished items are already ticked.${from ? ` Everything delivered stays with Iteration ${String(from)}.` : ""}`}
      submitLabel={vm.label}
      submitting={vm.submitting}
      error={vm.error}
      canSubmit={vm.goalError === null}
      size="wide"
      onSubmit={() => void vm.submit()}
    >
      <div className="iteration-start">
        <GoalField vm={vm} />
        <CarryOverList vm={vm} />
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
