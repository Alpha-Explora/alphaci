/* Starting the next iteration (Iterations phase 3): who is offered it, what
 * everyone else is told while they wait (P15), the request, and how a refusal
 * reads. Pure: no React, no fetch, no Next.
 *
 * The server alone decides who may start (`canStartNext`: a lead or admin,
 * and no iteration active). The new iteration starts with an empty
 * checklist: every item was passed before the last one could merge, so
 * nothing is carried over. On a backend that does not send `canStartNext`,
 * every rule here answers "nothing": the screens render exactly as before. */

import type { AppRole } from '@/shared/api/contracts';

import {
  iterationDateLabel,
  iterationName,
  iterationVersionName,
  normalizeIteration,
  versionNumberText,
  type IterationNameInput,
} from './iteration-rules';
import type {
  CurrentIteration,
  IterationNextStep,
  IterationVersion,
  RevisionType,
  StartedIteration,
  StartIterationInput,
  VersionNumbers,
} from './iteration-types';
import { qaCodeMessage } from './qa-error-messages';
import { errorCode, errorStatus, record } from './wire-readers';

/** The goal's longest form, as the server enforces it. */
export const ITERATION_GOAL_MAX = 120;

const NONE: IterationNextStep = { kind: 'none' };

/** Product owners (`lead`) and admins start iterations (decision D5). */
export function roleCanStartIteration(
  role: AppRole | null | undefined,
): boolean {
  return role === 'lead' || role === 'admin';
}

export { versionNumberText };

/** "Start version 4", or with release versions "Start version 1.3.0". */
export function startIterationLabel(next: number | string): string {
  return `Start version ${String(next)}`;
}

type DeliveredIteration = IterationNameInput & { deliveredAt: string | null };

/** "Version 1.2.0 was delivered on 14 Oct 2026." (without a date: "… was delivered."; without a version: "Version 3 …"). */
export function iterationDeliveredOnText(
  iteration: DeliveredIteration,
  locale?: string,
): string {
  const date = iterationDateLabel(iteration.deliveredAt, {
    withYear: true,
    locale,
  });
  return `${iterationVersionName(iteration)} was delivered${date ? ` on ${date}` : ''}.`;
}

/**
 * Between delivery and the next start (P15): "Version 1.2.0 was delivered on
 * 14 Oct 2026. Waiting for the Product owner to start the next version."
 * Without release versions the next one is named by number ("version 4"):
 * with them, the Product owner has not chosen patch, minor or major yet.
 */
export function waitingForNextIterationText(
  iteration: DeliveredIteration,
  locale?: string,
): string {
  const versioned =
    Boolean(iteration.version) || Boolean(iteration.versionLabel);
  const next = versioned
    ? 'the next version'
    : `version ${String(iteration.number + 1)}`;
  return `${iterationDeliveredOnText(iteration, locale)} Waiting for the Product owner to start ${next}.`;
}

/**
 * What a screen shows once the Project's iteration is delivered and none is
 * active:
 * - `start` for a Product owner or admin the server lets start;
 * - `waiting` for everyone the server does not let start;
 * - `none` while an iteration is active, and whenever the server did not say
 *   (no `canStartNext`).
 */
export function iterationNextStep(
  current: CurrentIteration | null,
  role: AppRole | null | undefined,
  locale?: string,
): IterationNextStep {
  if (current?.iteration.status !== 'delivered') return NONE;
  if (current.canStartNext === false) {
    return {
      kind: 'waiting',
      text: waitingForNextIterationText(current.iteration, locale),
    };
  }
  if (current.canStartNext !== true || !roleCanStartIteration(role))
    return NONE;
  return {
    kind: 'start',
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

/** The request body: the goal trimmed, left out when empty, and the revision when chosen. Nothing is carried over. */
export function startIterationInput(
  goal: string,
  revisionType?: RevisionType,
): StartIterationInput {
  const trimmed = goal.trim();
  return {
    ...(trimmed ? { goal: trimmed } : {}),
    ...(revisionType ? { revisionType } : {}),
  };
}

/** The 201 answer. A body that is not one still reads as "started". */
export function normalizeStartedIteration(value: unknown): StartedIteration {
  const raw = record(value) ?? {};
  return { iteration: normalizeIteration(raw.iteration) };
}

/**
 * The Start dialog's sentence: the new iteration is empty, the delivered one
 * keeps its work. `names` are the version names once the server sends them.
 */
export function startIterationDescription(
  nextNumber: number,
  names?: { previous: string; next: string },
): string {
  const previous = names?.previous ?? iterationName(nextNumber - 1);
  const next = names?.next ?? iterationName(nextNumber);
  return `Name what this version is for. ${next} starts with an empty checklist: ${previous}'s requirements and QA results stay with ${previous}, read-only.`;
}

/* ── Patch, minor and major revisions ────────────────────────────────────── */

/** Smallest change first. Minor stays the dialog's default: it is what the server starts when nothing is chosen. */
export const REVISION_TYPES: ReadonlyArray<RevisionType> = [
  'patch',
  'minor',
  'major',
];

function bumped(
  previous: VersionNumbers,
  revision: RevisionType,
): VersionNumbers {
  const patch = previous.patch ?? 0;
  if (revision === 'major')
    return { major: previous.major + 1, minor: 0, patch: 0 };
  if (revision === 'minor')
    return { major: previous.major, minor: previous.minor + 1, patch: 0 };
  return { major: previous.major, minor: previous.minor, patch: patch + 1 };
}

/** v1.2.0 -> v1.2.1 (patch), v1.3.0 (minor) or v2.0.0 (major), as the server computes it. Pure. */
export function nextIterationVersion(
  previous: VersionNumbers,
  revision: RevisionType,
): IterationVersion {
  const next = bumped(previous, revision);
  const patch = next.patch ?? 0;
  return {
    major: next.major,
    minor: next.minor,
    patch,
    label: `v${versionNumberText(next)}`,
  };
}

export interface RevisionOption {
  value: RevisionType;
  /** "Minor revision · v1.3.0" (without a known version: "Minor revision"). */
  label: string;
  hint: string;
}

const REVISION_LABELS: Readonly<Record<RevisionType, string>> = {
  patch: 'Patch revision',
  minor: 'Minor revision',
  major: 'Major revision',
};

const REVISION_HINTS: Readonly<Record<RevisionType, string>> = {
  patch: 'Fixes only: no new features.',
  minor: 'New features on the same release line.',
  major: 'A new release line: large or breaking changes.',
};

/** The three choices in the Start dialog, each naming the version it leads to. */
export function revisionOptions(
  previous: VersionNumbers | null | undefined,
): RevisionOption[] {
  return REVISION_TYPES.map((value) => {
    const next = previous
      ? ` · ${nextIterationVersion(previous, value).label}`
      : '';
    return {
      value,
      label: `${REVISION_LABELS[value]}${next}`,
      hint: REVISION_HINTS[value],
    };
  });
}

const STATUS_COPY: Readonly<Record<number, string>> = {
  401: 'Your session has ended. Sign in again to start the next version.',
  403: 'Only a Product owner or admin can start the next version.',
  404: 'This Project could not be found, or this server cannot start versions yet.',
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
  return (
    (status !== null && STATUS_COPY[status]) ||
    'The next version could not be started. Try again in a moment.'
  );
}

/**
 * After ITERATION_ACTIVE someone else already started it: closing the dialog
 * re-reads the Project, so every screen shows the iteration that is active.
 */
export function startErrorRefreshesOnClose(cause: unknown): boolean {
  return errorCode(cause) === 'ITERATION_ACTIVE';
}
