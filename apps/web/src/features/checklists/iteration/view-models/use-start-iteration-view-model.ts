"use client";

import { useState } from "react";

import type { AppRole } from "@/shared/api/contracts";

import { iterationsRepository } from "../../data/iterations-repository";
import {
  ITERATION_GOAL_MAX,
  iterationGoalError,
  iterationNextStep,
  startErrorRefreshesOnClose,
  startIterationDescription,
  startIterationErrorMessage,
  startIterationInput,
  startIterationLabel,
} from "../../model/iteration-start-rules";
import type { CurrentIteration, IterationNextStep, StartedIteration } from "../../model/iteration-types";
import { announceIterationChanged } from "./iteration-epoch";

export interface StartIterationViewModel {
  /** What this viewer sees about the next iteration: nothing, the waiting sentence, or Start. */
  step: IterationNextStep;
  /** "Start iteration 4"; empty unless Start is offered. */
  label: string;
  /** The dialog's sentence: the new iteration starts empty; empty unless Start is offered. */
  description: string;
  open: boolean;
  goal: string;
  goalMax: number;
  /** An over-long goal, said as the viewer types. */
  goalError: string | null;
  submitting: boolean;
  /** A refused start, in product words. The dialog stays open with it. */
  error: string | null;
  openDialog: () => void;
  close: () => void;
  setGoal: (goal: string) => void;
  submit: () => Promise<void>;
}

/** The dialog's own state while it is open. */
interface DialogState {
  goal: string;
  error: string | null;
  /** Someone else started it meanwhile: closing re-reads the Project. */
  refreshOnClose: boolean;
}

const CLOSED: DialogState = { goal: "", error: null, refreshOnClose: false };

/** Everything the dialog shows, from its state. */
function dialogView(step: IterationNextStep, state: DialogState) {
  return {
    step,
    label: step.kind === "start" ? startIterationLabel(step.nextNumber) : "",
    description: step.kind === "start" ? startIterationDescription(step.nextNumber) : "",
    goal: state.goal,
    goalMax: ITERATION_GOAL_MAX,
    goalError: iterationGoalError(state.goal),
    error: state.error,
  };
}

/**
 * ViewModel for "Start iteration N+1": whether this viewer is offered it at
 * all, and the dialog — an optional goal. The new iteration starts with an
 * empty checklist (every item was passed before the last one merged, so
 * nothing is carried over). On success it announces the change, so the
 * iteration, requirements, QA run and My QA items of this Project all read
 * again; on a refusal the dialog stays open with the reason. The server
 * re-checks who may start, so nothing here can start an iteration on its own
 * say-so.
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
  const view = dialogView(step, dialog ?? CLOSED);

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
    const input = startIterationInput(dialog.goal);
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
      if (step.kind === "start" && !dialog) setDialog(CLOSED);
    },
    close,
    setGoal: (goal) => update((state) => ({ ...state, goal })),
    submit,
  };
}
