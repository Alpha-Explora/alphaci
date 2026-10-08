"use client";

import "./playwright-live.css";

import { useId, useState, type JSX } from "react";

import { TonePill } from "../../items";
import {
  formatLiveDuration,
  isLiveActive,
  liveHeadline,
  liveProgressShare,
  liveProgressText,
  liveTestStatusWord,
  showAllLabel,
  visibleLiveTests,
} from "../../model/playwright-live-rules";
import type {
  PlaywrightLiveRun,
  PlaywrightLiveRunningTest,
  PlaywrightLiveTest,
  PlaywrightLiveTestStatus,
} from "../../model/playwright-live-types";
import { ChevronDownIcon, CheckIcon, CrossIcon, SkipIcon } from "./studio-icons";

/* Live Playwright progress, one card per frontend repository at the top of
 * its section in the Playwright tab: what the run is doing, how far it got,
 * which tests are running now, and every test that finished, newest first.
 * The announcer beside it speaks milestones only. */

/* ── Header and bar ──────────────────────────────────────────────────────── */

function LiveBar({ run, label }: Readonly<{ run: PlaywrightLiveRun; label: string }>) {
  const share = liveProgressShare(run);
  const determinate = share !== null;
  return (
    <div
      className="qa-live__bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={determinate ? share : undefined}
      aria-valuetext={determinate ? liveProgressText(run) : "Waiting for the test count"}
      data-indeterminate={determinate ? "false" : "true"}
      data-tone={liveHeadline(run).tone}
    >
      <span className="qa-live__fill" style={determinate ? { width: `${String(share)}%` } : undefined} />
    </div>
  );
}

/* ── Now running ─────────────────────────────────────────────────────────── */

function testMeta(file: string | null, project: string | null, duration?: string | null): string {
  return [file, project, duration].filter((part): part is string => Boolean(part)).join(" · ");
}

function NowRunning({ tests }: Readonly<{ tests: ReadonlyArray<PlaywrightLiveRunningTest> }>) {
  const headingId = useId();
  if (tests.length === 0) return null;
  return (
    <div className="qa-live__now" aria-labelledby={headingId} role="group">
      <p id={headingId} className="qa-live__label">
        Now running
      </p>
      <ul className="qa-live__running">
        {tests.map((test) => (
          <li key={test.id} className="qa-live__running-test">
            <span className="qa-live__spinner" aria-hidden="true" />
            <span className="qa-live__test-text">
              <span className="qa-live__title">{test.title}</span>
              <span className="qa-live__meta">{testMeta(test.file, test.project)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Finished tests ──────────────────────────────────────────────────────── */

const ICONS: Record<PlaywrightLiveTestStatus, () => JSX.Element> = {
  passed: CheckIcon,
  failed: CrossIcon,
  skipped: SkipIcon,
  unknown: SkipIcon,
};

function TestIcon({ status }: Readonly<{ status: PlaywrightLiveTestStatus }>) {
  const Icon = ICONS[status];
  return (
    <span className="qa-live__icon" data-status={status}>
      <Icon />
      <span className="sr-only">{`${liveTestStatusWord(status)}: `}</span>
    </span>
  );
}

function TestText({ test }: Readonly<{ test: PlaywrightLiveTest }>) {
  // A skipped test never ran: no "0 ms".
  const duration = test.status === "skipped" ? null : formatLiveDuration(test.durationMs);
  return (
    <span className="qa-live__test-text">
      <span className="qa-live__title">{test.title}</span>
      <span className="qa-live__meta">{testMeta(test.file, test.project, duration)}</span>
    </span>
  );
}

/** A failed test unfolds to its error, monospace and wrapped. */
function FailedTest({ test }: Readonly<{ test: PlaywrightLiveTest }>) {
  const errorId = useId();
  const [open, setOpen] = useState(false);
  return (
    <li className="qa-live__test" data-status="failed">
      <button
        type="button"
        className="qa-live__expand"
        aria-expanded={open}
        aria-controls={errorId}
        onClick={() => setOpen((value) => !value)}
      >
        <TestIcon status="failed" />
        <TestText test={test} />
        <span className="qa-live__chevron" aria-hidden="true">
          <ChevronDownIcon />
        </span>
        <span className="sr-only">{open ? " — hide the error" : " — show the error"}</span>
      </button>
      <pre id={errorId} className="qa-live__error" hidden={!open}>
        {test.error ?? "No error message was reported."}
      </pre>
    </li>
  );
}

function FinishedTest({ test }: Readonly<{ test: PlaywrightLiveTest }>) {
  if (test.status === "failed") return <FailedTest test={test} />;
  return (
    <li className="qa-live__test" data-status={test.status}>
      <span className="qa-live__row">
        <TestIcon status={test.status} />
        <TestText test={test} />
      </span>
    </li>
  );
}

function finishedHeading(run: PlaywrightLiveRun): string {
  const skipped = run.skipped > 0 ? ` · ${String(run.skipped)} skipped` : "";
  return `Finished · ${String(run.passed)} passed · ${String(run.failed)} failed${skipped}`;
}

/**
 * Every finished test, newest first, capped at 50 until "Show all". Open
 * while the run is going; a run first seen already finished folds it away
 * (its stage card below already sums it up).
 */
function FinishedTests({ run, openAtFirst }: Readonly<{ run: PlaywrightLiveRun; openAtFirst: boolean }>) {
  const listId = useId();
  const [open, setOpen] = useState(openAtFirst);
  const [showAll, setShowAll] = useState(false);
  if (run.tests.length === 0) return null;
  const more = showAllLabel(run.tests.length, showAll);
  return (
    <div className="qa-live__finished">
      <button
        type="button"
        className="qa-live__label qa-live__toggle"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        {finishedHeading(run)}
        <ChevronDownIcon />
      </button>
      <div id={listId} hidden={!open}>
        <ol className="qa-live__tests" aria-label="Finished tests, newest first">
          {visibleLiveTests(run.tests, showAll).map((test) => (
            <FinishedTest key={test.id} test={test} />
          ))}
        </ol>
        {more ? (
          <button type="button" className="qa-text-button qa-live__more" onClick={() => setShowAll(true)}>
            {more}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ── The card ────────────────────────────────────────────────────────────── */

/**
 * One repository's Playwright run, live: the status pill and what it is
 * doing, the progress bar (indeterminate until the total is known), the
 * tests running now and the finished list.
 */
export function PlaywrightLiveCard({
  run,
  name,
  labelled = false,
}: Readonly<{
  run: PlaywrightLiveRun;
  /** The repository, for screen readers always; shown when `labelled` (a section covering several). */
  name: string;
  labelled?: boolean;
}>) {
  const headingId = useId();
  const headline = liveHeadline(run);
  const active = isLiveActive(run);
  return (
    <section className="qa-live" data-status={run.status} data-active={active ? "true" : "false"} aria-labelledby={headingId}>
      <div className="qa-live__head">
        <h5 id={headingId} className="qa-live__heading">
          <span className="sr-only">{`Playwright in ${name}: `}</span>
          <TonePill tone={headline.tone} label={headline.label} />
          {headline.detail ? <span className="qa-live__detail">{headline.detail}</span> : null}
        </h5>
        {labelled ? <span className="qa-live__repo">{name}</span> : null}
      </div>
      <LiveBar run={run} label={`Playwright progress in ${name}`} />
      {active ? <NowRunning tests={run.running} /> : null}
      {/* Seen going, the list stays open when the run finishes; first seen finished, it starts folded. */}
      <FinishedTests run={run} openAtFirst={active} />
    </section>
  );
}

/** Milestones only (started, each failure, finished), politely. Always mounted, so changes are announced. */
export function LiveAnnouncer({ text }: Readonly<{ text: string }>) {
  return (
    <p className="sr-only" role="status" aria-live="polite" data-live="playwright">
      {text}
    </p>
  );
}
