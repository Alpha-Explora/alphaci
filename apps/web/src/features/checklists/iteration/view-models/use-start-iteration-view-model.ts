"use client";

import { useState } from "react";

import type { AppRole } from "@/shared/api/contracts";

import { iterationsRepository } from "../../data/iterations-repository";
import {
  carryOverGroups,
  carryOverItemIds,
  carrySelectionLabel,
  selectAllUnfinished,
  selectedCarryIds,
  toggleCarryItem,
  unfinishedItemIds,
  type CarryOverGroup,
} from "../../model/iteration-carry-over-rules";
import {
  ITERATION_GOAL_MAX,
  iterationGoalError,
  iterationNextStep,
  startErrorRefreshesOnClose,
  startIterationErrorMessage,
  startIterationInput,
  startIterationLabel,
} from "../../model/iteration-start-rules";
import type { CarryOver, CurrentIteration, IterationNextStep, StartedIteration } from "../../model/iteration-types";
import { announceIterationChanged } from "./iteration-epoch";

export interface StartIterationViewModel {
  /** What this viewer sees about the next iteration: nothing, the waiting sentence, or Start. */
  step: IterationNextStep;
  /** "Start iteration 4"; empty unless Start is offered. */
  label: string;
  /** The delivered iteration the list comes from. */
  fromIterationNumber: number | null;
  open: boolean;
  goal: string;
  goalMax: number;
  /** An over-long goal, said as the viewer types. */
  goalError: string | null;
  groups: CarryOverGroup[];
  selectedCount: number;
  totalCount: number;
  unfinishedCount: number;
  /** "3 of 7 items selected". */
  selectionLabel: string;
  submitting: boolean;
  /** A refused start, in product words. The dialog stays open with it. */
  error: string | null;
  openDialog: () => void;
  close: () => void;
  setGoal: (goal: string) => void;
  toggleItem: (id: string) => void;
  selectAllUnfinished: () => void;
  clear: () => void;
  submit: () => Promise<void>;
}

/** The dialog's own state while it is open. */
interface DialogState {
  goal: string;
  selected: ReadonlySet<string>;
  error: string | null;
  /** Someone else started it meanwhile: closing re-reads the Project. */
  refreshOnClose: boolean;
}

const CLOSED: DialogState = { goal: "", selected: new Set<string>(), error: null, refreshOnClose: false };

/** Opening: no goal, and every unfinished item pre-checked. */
function freshDialog(carryOver: CarryOver | null): DialogState {
  return { ...CLOSED, selected: new Set(unfinishedItemIds(carryOver)) };
}

/** The carry-over list, only while Start is offered. */
function offeredCarryOver(step: IterationNextStep, current: CurrentIteration | null): CarryOver | null {
  return step.kind === "start" ? (current?.carryOver ?? null) : null;
}

/** Everything the dialog shows, from its state and the list. */
function dialogView(step: IterationNextStep, state: DialogState, carryOver: CarryOver | null) {
  const ids = selectedCarryIds(state.selected, carryOver);
  const total = carryOverItemIds(carryOver).length;
  return {
    step,
    label: step.kind === "start" ? startIterationLabel(step.nextNumber) : "",
    fromIterationNumber: carryOver ? carryOver.fromIterationNumber : null,
    goal: state.goal,
    goalMax: ITERATION_GOAL_MAX,
    goalError: iterationGoalError(state.goal),
    groups: carryOverGroups(carryOver, state.selected),
    selectedCount: ids.length,
    totalCount: total,
    unfinishedCount: unfinishedItemIds(carryOver).length,
    selectionLabel: carrySelectionLabel(ids.length, total),
    error: state.error,
  };
}

/**
 * ViewModel for "Start iteration N+1" (Iterations phase 3): whether this
 * viewer is offered it at all, and the dialog — an optional goal and the
 * delivered iteration's items to carry over, the unfinished ones pre-checked.
 * On success it announces the change, so the iteration, requirements, QA run
 * and My QA items of this Project all read again; on a refusal the dialog
 * stays open with the reason. The server re-checks who may start and what
 * may be carried, so nothing here can start an iteration on its own say-so.
 */
export function useStartIterationViewModel(options: {
  deliveryProjectId: string;
  current: CurrentIteration | null;
  appRole: AppRole | null | undefined;
  /** After a start: what else on the screen must read again (PO Studio's promotion status). */
  onStarted?: (started: StartedIteration) => void;
}): StartIterationViewModel {
  const { deliveryProjectId, current, appRole, onStarted } = options;
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const step = iterationNextStep(current, appRole);
  const carryOver = offeredCarryOver(step, current);
  const view = dialogView(step, dialog ?? CLOSED, carryOver);

  function update(change: (state: DialogState) => DialogState) {
    setDialog((state) => (state ? change(state) : state));
  }

  function close() {
    if (submitting) return;
    if (dialog?.refreshOnClose) announceIterationChanged(deliveryProjectId);
    setDialog(null);
  }

  async function submit() {
    if (!dialog || submitting || step.kind !== "start" || view.goalError) return;
    const input = startIterationInput(dialog.goal, selectedCarryIds(dialog.selected, carryOver));
    setSubmitting(true);
    update((state) => ({ ...state, error: null }));
    try {
      const started = await iterationsRepository.start(deliveryProjectId, input);
      setDialog(null);
      announceIterationChanged(deliveryProjectId);
      onStarted?.(started);
    } catch (cause) {
      const refreshOnClose = startErrorRefreshesOnClose(cause);
      update((state) => ({ ...state, error: startIterationErrorMessage(cause), refreshOnClose }));
    } finally {
      setSubmitting(false);
    }
  }

  return {
    ...view,
    open: dialog !== null && step.kind === "start",
    submitting,
    openDialog: () => {
      if (step.kind === "start" && !dialog) setDialog(freshDialog(carryOver));
    },
    close,
    setGoal: (goal) => update((state) => ({ ...state, goal })),
    toggleItem: (id) => update((state) => ({ ...state, selected: toggleCarryItem(state.selected, id) })),
    selectAllUnfinished: () =>
      update((state) => ({ ...state, selected: selectAllUnfinished(state.selected, carryOver) })),
    clear: () => update((state) => ({ ...state, selected: new Set<string>() })),
    submit,
  };
}
