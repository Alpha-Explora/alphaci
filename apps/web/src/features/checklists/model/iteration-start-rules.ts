/* Starting the next iteration (Iterations phase 3): who is offered it, what
 * everyone else is told while they wait (P15), the request, and how a refusal
 * reads. Pure: no React, no fetch, no Next.
 *
 * The server alone decides who may start (`canStartNext`: a lead or admin,
 * and no iteration active) and what may be carried. On a backend that does
 * not send `canStartNext` or `carryOver`, every rule here answers "nothing":
 * the screens render exactly as before. */

import type { AppRole } from "@/shared/api/contracts";

import { iterationDateLabel, iterationName, normalizeIteration } from "./iteration-rules";
import type { CurrentIteration, IterationNextStep, StartedIteration, StartIterationInput } from "./iteration-types";
import { qaCodeMessage } from "./qa-error-messages";
import { errorCode, errorStatus, record } from "./wire-readers";

/** The goal's longest form, as the server enforces it. */
export const ITERATION_GOAL_MAX = 120;

const NONE: IterationNextStep = { kind: "none" };

/** Product owners (`lead`) and admins start iterations (decision D5). */
export function roleCanStartIteration(role: AppRole | null | undefined): boolean {
  return role === "lead" || role === "admin";
}

/** "Start iteration 4". */
export function startIterationLabel(nextNumber: number): string {
  return `Start iteration ${String(nextNumber)}`;
}

type DeliveredIteration = { number: number; deliveredAt: string | null };

/** "Iteration 3 was delivered on 14 Oct 2026." (without a date: "Iteration 3 was delivered."). */
export function iterationDeliveredOnText(iteration: DeliveredIteration, locale?: string): string {
  const date = iterationDateLabel(iteration.deliveredAt, { withYear: true, locale });
  return `${iterationName(iteration.number)} was delivered${date ? ` on ${date}` : ""}.`;
}

/**
 * Between delivery and the next start (P15): "Iteration 3 was delivered on
 * 14 Oct 2026. Waiting for the Product owner to start iteration 4."
 */
export function waitingForNextIterationText(iteration: DeliveredIteration, locale?: string): string {
  return `${iterationDeliveredOnText(iteration, locale)} Waiting for the Product owner to start iteration ${String(iteration.number + 1)}.`;
}

/**
 * What a screen shows once the Project's iteration is delivered and none is
 * active:
 * - `start` for a Product owner or admin the server lets start, when it also
 *   sent the carry-over list;
 * - `waiting` for everyone the server does not let start;
 * - `none` while an iteration is active, and whenever the server did not say
 *   (no `canStartNext`, or `canStartNext` without `carryOver`).
 */
export function iterationNextStep(
  current: CurrentIteration | null,
  role: AppRole | null | undefined,
  locale?: string,
): IterationNextStep {
  if (current?.iteration.status !== "delivered") return NONE;
  if (current.canStartNext === false) {
    return { kind: "waiting", text: waitingForNextIterationText(current.iteration, locale) };
  }
  if (current.canStartNext !== true || !current.carryOver || !roleCanStartIteration(role)) return NONE;
  return {
    kind: "start",
    nextNumber: current.iteration.number + 1,
    text: iterationDeliveredOnText(current.iteration, locale),
  };
}

/** An over-long goal, in the viewer's words; null when it fits. */
export function iterationGoalError(goal: string): string | null {
  return goal.trim().length > ITERATION_GOAL_MAX
    ? `A goal is at most ${String(ITERATION_GOAL_MAX)} characters.`
    : null;
}

/** The request body: the goal trimmed (left out when empty) and the carried item ids. */
export function startIterationInput(goal: string, requirementItemIds: ReadonlyArray<string>): StartIterationInput {
  const trimmed = goal.trim();
  const carryOver = { requirementItemIds: [...requirementItemIds] };
  return trimmed ? { goal: trimmed, carryOver } : { carryOver };
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

/** The 201 answer. A body that is not one still reads as "started", with nothing counted. */
export function normalizeStartedIteration(value: unknown): StartedIteration {
  const raw = record(value) ?? {};
  return {
    iteration: normalizeIteration(raw.iteration),
    carriedRequirements: count(raw.carriedRequirements),
    carriedItems: count(raw.carriedItems),
  };
}

const STATUS_COPY: Readonly<Record<number, string>> = {
  401: "Your session has ended. Sign in again to start the next iteration.",
  403: "Only a Product owner or admin can start the next iteration.",
  404: "This Project could not be found, or this server cannot start iterations yet.",
};

/**
 * A refused start, as a sentence: ITERATION_ACTIVE and ITERATION_CARRY_INVALID
 * in product words, then the status, then a generic retry. Never the server's
 * own message.
 */
export function startIterationErrorMessage(cause: unknown): string {
  const byCode = qaCodeMessage(cause);
  if (byCode) return byCode;
  const status = errorStatus(cause);
  return (status !== null && STATUS_COPY[status]) || "The next iteration could not be started. Try again in a moment.";
}

/**
 * After ITERATION_ACTIVE someone else already started it: closing the dialog
 * re-reads the Project, so every screen shows the iteration that is active.
 */
export function startErrorRefreshesOnClose(cause: unknown): boolean {
  return errorCode(cause) === "ITERATION_ACTIVE";
}
