"use client";

import "./test-report.css";

import { useId, useState } from "react";

import type { TestCase } from "@/shared/api/contracts";

import {
  durationLabel,
  hasTestDetail,
  noteLabel,
  orderTestCases,
  testCaseMeta,
  testCaseName,
  testCaseStatusWord,
  testCaseTone,
  testListHeading,
  testListStartsOpen,
} from "../model/test-case-rules";

function StatusMark({ test }: Readonly<{ test: TestCase }>) {
  return (
    <span className="tr-case__status" data-tone={testCaseTone(test.status)}>
      <span className="tr-case__dot" aria-hidden="true" />
      {testCaseStatusWord(test.status)}
    </span>
  );
}

function Steps({ steps }: Readonly<{ steps: NonNullable<TestCase["steps"]> }>) {
  return (
    <ol className="tr-case__steps" aria-label="Steps">
      {steps.map((step, index) => (
        <li key={`${String(index)}-${step.title}`} data-failed={step.failed ? "true" : undefined}>
          <span className="tr-case__step-title">{step.title}</span>
          {step.failed ? <span className="tr-case__step-failed">failed</span> : null}
          {durationLabel(step.durationMs) ? (
            <span className="tr-case__step-time">{durationLabel(step.durationMs)}</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function Detail({ test, id }: Readonly<{ test: TestCase; id: string }>) {
  return (
    <div id={id} className="tr-case__detail">
      {test.steps ? <Steps steps={test.steps} /> : null}
      {test.error ? (
        <>
          <pre className="tr-case__error">{test.error.message}</pre>
          {test.error.location ? <p className="tr-case__where">at {test.error.location}</p> : null}
        </>
      ) : null}
    </div>
  );
}

function TestRow({ test }: Readonly<{ test: TestCase }>) {
  const detailId = useId();
  // A failure opens on its error; everything else waits for a click.
  const [open, setOpen] = useState(test.status === "failed");
  const unfolds = hasTestDetail(test);
  const meta = testCaseMeta(test);
  return (
    <li className="tr-case" data-tone={testCaseTone(test.status)}>
      <div className="tr-case__head">
        <StatusMark test={test} />
        <span className="tr-case__name">{testCaseName(test)}</span>
      </div>
      {test.description ? <p className="tr-case__description">{test.description}</p> : null}
      {meta ? <p className="tr-case__meta">{meta}</p> : null}
      {test.notes ? (
        <ul className="tr-case__notes">
          {test.notes.map((note, index) => (
            <li key={`${String(index)}-${note.type}`}>
              <span className="tr-case__note-label">{noteLabel(note.type)}</span> {note.text}
            </li>
          ))}
        </ul>
      ) : null}
      {unfolds ? (
        <>
          <button
            type="button"
            className="tr-case__toggle"
            aria-expanded={open}
            aria-controls={open ? detailId : undefined}
            onClick={() => setOpen(!open)}
          >
            {open ? "Hide" : "Show"} {test.error ? "steps and error" : "steps"}
          </button>
          {open ? <Detail test={test} id={detailId} /> : null}
        </>
      ) : null}
    </li>
  );
}

function Chevron() {
  return (
    <svg className="tr-cases__chevron" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m4.25 6.25 3.75 3.75 3.75-3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Every browser test of a run: its result, what it checks, where it is and how
 * long it took, what it found, and — unfolded — its steps and full error.
 * Failures come first and open on their error. `foldable` turns the heading
 * into a toggle for the whole list, open at first only when a test failed.
 */
export function TestCaseList({
  cases,
  total,
  label = "Browser tests",
  foldable = false,
}: Readonly<{
  cases: readonly TestCase[];
  /** The run's own test count, when the list may be a prefix of it. */
  total?: number | null;
  label?: string;
  foldable?: boolean;
}>) {
  const headingId = useId();
  const listId = useId();
  const [open, setOpen] = useState(() => !foldable || testListStartsOpen(cases));
  if (cases.length === 0) return null;
  const heading = (
    <>
      {label} <span className="tr-cases__count">· {testListHeading(cases, total)}</span>
    </>
  );
  return (
    <section className="tr-cases" aria-labelledby={headingId}>
      <h6 id={headingId} className="tr-cases__heading">
        {foldable ? (
          <button
            type="button"
            className="tr-cases__toggle"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen(!open)}
          >
            {heading}
            <Chevron />
          </button>
        ) : (
          heading
        )}
      </h6>
      <ul id={listId} className="tr-cases__list" hidden={!open}>
        {orderTestCases(cases).map((test, index) => (
          <TestRow key={`${String(index)}-${test.title}-${test.project ?? ""}`} test={test} />
        ))}
      </ul>
    </section>
  );
}
