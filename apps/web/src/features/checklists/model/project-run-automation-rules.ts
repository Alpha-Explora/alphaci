/* Pure readers for a Project run's CI results and its "Run Playwright"
 * reply. No React, no fetch.
 *
 * The backend (qa-project-runs.service.ts, assembleRun) reads CI for every
 * repository the run covers, on the uat head the run captured, and sends:
 *
 *   automation              the first report per stage across repositories
 *   automationByRepository  [{ projectId, repoFullName, automation }]
 *   items[].automated       each automated item matched across repositories
 *
 * A backend from before that sends none of these. Every reader here accepts
 * anything — undefined, null, a partial object — and says "not sent" with
 * null, so the Playwright tab can tell an older server from "no results". */

import { normalizeRunAutomation } from "./qa-automation-rules";
import type { QaRunAutomationResult } from "./qa-automation-types";
import type {
  ProjectDispatched,
  ProjectDispatchFailure,
  ProjectDispatchResult,
  RepositoryAutomation,
} from "./project-run-types";
import { record, records, text, type Loose } from "./wire-readers";

/** The merged result, or null when the body has no `automation` key at all. */
export function projectRunAutomationFrom(raw: Loose): QaRunAutomationResult | null {
  return "automation" in raw ? normalizeRunAutomation(raw.automation) : null;
}

function repositoryAutomationFrom(value: Loose): RepositoryAutomation | null {
  const projectId = text(value.projectId);
  const repoFullName = text(value.repoFullName);
  if (!projectId || !repoFullName) return null;
  return { projectId, repoFullName, automation: normalizeRunAutomation(value.automation) };
}

/** The per-repository breakdown, or null when the server sent none. */
export function automationByRepositoryFrom(raw: Loose): RepositoryAutomation[] | null {
  if (!Array.isArray(raw.automationByRepository)) return null;
  return records(raw.automationByRepository)
    .map(repositoryAutomationFrom)
    .filter((entry): entry is RepositoryAutomation => entry !== null);
}

function dispatchedFrom(value: Loose): ProjectDispatched | null {
  const projectId = text(value.projectId);
  if (!projectId) return null;
  return {
    projectId,
    repoFullName: text(value.repoFullName) ?? projectId,
    ref: text(value.ref),
    headSha: text(value.headSha),
    targetsRunCommit: typeof value.targetsRunCommit === "boolean" ? value.targetsRunCommit : null,
  };
}

const FAILURE_FALLBACK = "Playwright could not be started in this repository.";

function failureFrom(value: Loose): ProjectDispatchFailure | null {
  const projectId = text(value.projectId);
  if (!projectId) return null;
  return {
    projectId,
    repoFullName: text(value.repoFullName) ?? projectId,
    code: text(value.code),
    message: text(value.message) ?? FAILURE_FALLBACK,
  };
}

/** The 202 reply: where the verify workflow started, and where it could not. */
export function normalizeProjectDispatch(value: unknown): ProjectDispatchResult {
  const raw = record(value) ?? {};
  return {
    dispatched: records(raw.dispatched)
      .map(dispatchedFrom)
      .filter((entry): entry is ProjectDispatched => entry !== null),
    failed: records(raw.failed)
      .map(failureFrom)
      .filter((entry): entry is ProjectDispatchFailure => entry !== null),
  };
}
