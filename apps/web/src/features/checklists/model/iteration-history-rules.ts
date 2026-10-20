/* The Project's History: every iteration, newest first, and how a delivered
 * one is described. Pure: no React, no fetch, no Next.
 *
 * A delivered iteration is a frozen record. Its checklist and QA results are
 * the report QA signed off (the run's `signoffRunId`), read as it was; the
 * active iteration is worked in on the Checklists tab, not here. */

import type { HistoryIteration } from "./iteration-types";
import { iterationDateLabel, normalizeIteration } from "./iteration-rules";
import { record, records, text } from "./wire-readers";

function login(raw: unknown): string | null {
  return text(record(raw)?.login);
}

function historyIterationFrom(value: unknown): HistoryIteration | null {
  const iteration = normalizeIteration(value);
  const raw = record(value);
  if (!iteration || !raw) return null;
  return {
    ...iteration,
    startedAt: text(raw.startedAt),
    startedByLogin: login(raw.startedBy),
    signoffRunId: text(raw.signoffRunId),
  };
}

/** GET /delivery-projects/:id/iterations, newest first whatever order the server sent. */
export function normalizeIterationHistory(value: unknown): HistoryIteration[] {
  return records(record(value)?.iterations)
    .map(historyIterationFrom)
    .filter((iteration): iteration is HistoryIteration => iteration !== null)
    .sort((a, b) => b.number - a.number);
}

/**
 * The line under an iteration's title: "Delivered 15 Oct 2026 by @ana ·
 * started 2 Oct 2026", or "In progress · started 2 Oct 2026".
 */
export function historyMetaLabel(iteration: HistoryIteration, locale?: string): string {
  const started = iterationDateLabel(iteration.startedAt, { withYear: true, locale });
  const startedPart = started ? `started ${started}` : null;
  if (iteration.status === "active") return ["In progress", startedPart].filter(Boolean).join(" · ");
  const delivered = iterationDateLabel(iteration.deliveredAt, { withYear: true, locale });
  const by = iteration.deliveredByLogin ? ` by @${iteration.deliveredByLogin}` : "";
  return [`Delivered${delivered ? ` ${delivered}` : ""}${by}`, startedPart].filter(Boolean).join(" · ");
}

/** What a card says instead of a checklist, when it has none to show. */
export function historyNoReportText(iteration: Pick<HistoryIteration, "status" | "signoffRunId">): string | null {
  if (iteration.status === "active") {
    return "This version is in progress. Its requirements, progress and QA testing are on the Checklists tab.";
  }
  if (!iteration.signoffRunId) return "No QA sign-off was recorded for this version.";
  return null;
}

/** "Signed off Approved by @ana-qa on 15 Oct 2026". */
export function historySignoffLabel(
  signoff: { signedBy: { login: string | null } | null; signedAt: string | null },
  locale?: string,
): string {
  const by = signoff.signedBy?.login ? ` by @${signoff.signedBy.login}` : "";
  const date = iterationDateLabel(signoff.signedAt, { withYear: true, locale });
  return `Signed off${by}${date ? ` on ${date}` : ""}`;
}

export const HISTORY_EMPTY_TEXT = "No versions yet. Version 1 appears here once the Project has requirements.";

export const HISTORY_INTRO =
  "Every version of this Project. A delivered one is read-only: its checklist and QA results exactly as QA signed them off.";
