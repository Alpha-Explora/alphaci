"use client";

import "./automation.css";

import { useId } from "react";

import { TonePill } from "../../items";
import {
  automationStages,
  failuresToggleLabel,
  listedFailures,
  stageCoverage,
  stageName,
  stagePassShare,
  stageRunLabel,
  stageRunTone,
  stageTestsLabel,
  unlistedFailuresNote,
} from "../../model/qa-automation-rules";
import type {
  QaAutomationStage,
  QaRunAutomationResult,
  QaStageResult,
  QaStageTests,
} from "../../model/qa-automation-types";
import { formatReportDate } from "../../model/qa-report-rules";
import { agoLabel, shortSha } from "../../model/qa-run-rules";
import type { AutomationDispatchControls } from "../view-models/use-qa-automation-view-model";
import { useDisclosure } from "../view-models/use-remembered-flag";
import { ChevronDownIcon, CrossIcon, PlayIcon, WarningIcon } from "./studio-icons";

/* The building blocks of the studio column's Playwright tab: one card per CI
 * stage, "Run Playwright" and what starting it said. The tab arranges them
 * per repository (playwright-panel.tsx). */

/* ── One stage ───────────────────────────────────────────────────────────── */

/** "22 / 24 passed" and a slim bar of the passed share. */
function StageFigures({ tests }: Readonly<{ tests: QaStageTests | null }>) {
  const label = stageTestsLabel(tests);
  const share = stagePassShare(tests);
  if (!label) return <span className="qa-auto-stage__none">No test counts reported</span>;
  return (
    <span className="qa-auto-stage__figures">
      <span className="qa-auto-stage__count">{label}</span>
      {share === null ? null : (
        <span className="qa-auto-stage__bar" aria-hidden="true">
          <span className="qa-auto-stage__fill" style={{ width: `${share}%` }} />
        </span>
      )}
    </span>
  );
}

function FailureList({
  id,
  stage,
  tests,
  hidden,
}: Readonly<{ id: string; stage: QaAutomationStage; tests: QaStageTests | null; hidden: boolean }>) {
  const failures = listedFailures(tests);
  const note = unlistedFailuresNote(tests);
  if (failures.length === 0 && !note) return null;
  return (
    <div id={id} className="qa-auto-failures" hidden={failures.length > 0 && hidden}>
      {failures.length > 0 ? (
        <ol className="qa-auto-failures__list" aria-label={`${stageName(stage)} failures`}>
          {failures.map((failure, index) => (
            <li key={`${index}-${failure.name}`} className="qa-auto-failure">
              <CrossIcon />
              <div className="qa-auto-failure__body">
                <code className="qa-auto-failure__name">{failure.name}</code>
                {failure.message ? (
                  <p className="qa-auto-failure__message" title={failure.message}>
                    {failure.message}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {note ? <p className="qa-auto-failures__note">{note}</p> : null}
    </div>
  );
}

interface FailuresDisclosure {
  id: string;
  open: boolean;
  onToggle: () => void;
}

/**
 * "2 failed ▾": the failed count doubles as the disclosure for the failures
 * list, so the stage stays one line of facts. A plain count when CI listed
 * none.
 */
function FailedToggle({ tests, disclosure }: Readonly<{ tests: QaStageTests | null; disclosure: FailuresDisclosure }>) {
  const failed = tests?.failed ?? 0;
  const toggleLabel = failuresToggleLabel(tests, disclosure.open);
  if (!toggleLabel) return failed > 0 ? <span className="qa-auto-stage__failed">{failed} failed</span> : null;
  const listed = listedFailures(tests).length;
  return (
    <button
      type="button"
      className="qa-auto-stage__failed qa-auto-stage__toggle"
      aria-expanded={disclosure.open}
      aria-controls={disclosure.id}
      title={toggleLabel}
      onClick={disclosure.onToggle}
    >
      {failed > 0 ? `${failed} failed` : `${listed} ${listed === 1 ? "failure" : "failures"}`}
      <span className="sr-only">{` — ${toggleLabel.toLowerCase()}`}</span>
      <ChevronDownIcon />
    </button>
  );
}

/** "22 / 24 passed ▬▬ · 2 failed ▾ · 3m ago". */
function StageMeta({ result, disclosure }: Readonly<{ result: QaStageResult; disclosure: FailuresDisclosure }>) {
  const ago = agoLabel(result.reportedAt);
  return (
    <p className="qa-auto-stage__meta">
      <StageFigures tests={result.tests} />
      <FailedToggle tests={result.tests} disclosure={disclosure} />
      {ago ? (
        <span>
          <span className="sr-only">Reported </span>
          <time dateTime={result.reportedAt ?? undefined} title={`Reported ${formatReportDate(result.reportedAt)}`}>
            {ago}
          </time>
        </span>
      ) : null}
    </p>
  );
}

/**
 * One CI stage in two lines: its name and verdict; then the counts, when it
 * reported and its failures. The failures list folds away so the panel
 * never crowds out the items — each item already shows its own failure.
 */
function StageCard({ result }: Readonly<{ result: QaStageResult }>) {
  const headingId = useId();
  const failuresId = useId();
  const [open, toggle] = useDisclosure();
  const tone = stageRunTone(result.status);
  return (
    <article className={`qa-auto-stage qa-auto-stage--${tone}`} aria-labelledby={headingId}>
      <div className="qa-auto-stage__row">
        <h4 id={headingId} className="qa-auto-stage__title">
          {stageName(result.stage)}
          <span className="qa-auto-stage__coverage"> — {stageCoverage(result.stage)}</span>
        </h4>
        <TonePill tone={tone} label={stageRunLabel(result.status)} />
      </div>
      <StageMeta result={result} disclosure={{ id: failuresId, open, onToggle: toggle }} />
      <FailureList id={failuresId} stage={result.stage} tests={result.tests} hidden={!open} />
    </article>
  );
}

/** A stage that has not reported while the other has: say so, compactly. */
function StageMissing({ stage, commitSha }: Readonly<{ stage: QaAutomationStage; commitSha: string | null }>) {
  const short = shortSha(commitSha);
  return (
    <p className="qa-auto-stage qa-auto-stage--missing">
      <span className="qa-auto-stage__title">
        {stageName(stage)}
        <span className="qa-auto-stage__coverage"> — {stageCoverage(stage)}</span>
      </span>
      <span className="qa-auto-stage__none">{short ? `Not reported for ${short} yet` : "Not reported yet"}</span>
    </p>
  );
}

/* ── Run Playwright and its feedback ─────────────────────────────────────── */

function runButtonLabel(vm: AutomationDispatchControls): string {
  if (vm.status === "dispatching") return "Starting…";
  return vm.status === "watching" || vm.status === "dispatched" ? "Run Playwright again" : "Run Playwright";
}

/** For QA Team, Team leads and Admins; disabled (with the reason) on a signed-off run. */
export function RunPlaywrightButton({ vm, reasonId }: Readonly<{ vm: AutomationDispatchControls; reasonId: string }>) {
  if (!vm.canDispatch) return null;
  return (
    <button
      type="button"
      className="qa-auto__run"
      disabled={vm.status === "dispatching" || vm.blockedReason !== null}
      aria-describedby={vm.blockedReason ? reasonId : undefined}
      onClick={() => void vm.dispatch()}
    >
      <PlayIcon />
      {runButtonLabel(vm)}
    </button>
  );
}

/** Why the offered button is disabled; nothing when it is not. */
export function DispatchReason({ vm, id }: Readonly<{ vm: AutomationDispatchControls; id: string }>) {
  if (!vm.canDispatch || !vm.blockedReason) return null;
  return (
    <p id={id} className="qa-auto__reason">
      {vm.blockedReason}
    </p>
  );
}

/** Always mounted, so the confirmation is announced when it appears. */
export function DispatchFeedback({ vm }: Readonly<{ vm: AutomationDispatchControls }>) {
  return (
    <>
      <div className="qa-auto__live" role="status" aria-live="polite">
        {vm.confirmation ? (
          <p className="qa-auto__confirm">
            <span className="qa-auto__pulse" data-watching={vm.status === "watching" ? "true" : "false"} aria-hidden="true" />
            <span>
              {vm.confirmation}
              {vm.status === "watching" ? <span className="qa-auto__watching"> Checking every 20 seconds.</span> : null}
            </span>
          </p>
        ) : null}
        {vm.warning ? (
          <p className="qa-auto__warning">
            <WarningIcon />
            <span>{vm.warning}</span>
          </p>
        ) : null}
      </div>
      {vm.error ? (
        <div className="qa-inline-alert qa-auto__error" role="alert">
          <p>{vm.error.message}</p>
          {vm.error.signIn ? (
            <a className="ghost-button qa-auto__signin" href={vm.signInHref}>
              Sign in again
            </a>
          ) : null}
          <button type="button" className="qa-text-button" onClick={vm.dismiss}>
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  );
}

/* ── The stages ──────────────────────────────────────────────────────────── */

/**
 * How the verify (browser & API) and quality (unit) stages went on one
 * commit: a card per stage that reported, a line for one that has not.
 * Information only: sign-off stays manual.
 */
export function AutomationStages({
  automation,
  commitSha,
}: Readonly<{ automation: QaRunAutomationResult; commitSha: string | null }>) {
  return (
    <div className="qa-auto__stages">
      {automationStages(automation).map(({ stage, result }) =>
        result ? (
          <StageCard key={stage} result={result} />
        ) : (
          <StageMissing key={stage} stage={stage} commitSha={commitSha} />
        ),
      )}
    </div>
  );
}
