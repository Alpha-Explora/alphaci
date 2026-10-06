"use client";

import "./pipeline-browser-tests.css";

import { useId, type MouseEvent } from "react";

import {
  ADD_BUTTON_LABEL,
  INSTALLED_LINE,
  browserTestsCardState,
  missingChecks,
  openedLabel,
  splitNote,
  type BrowserTestsError,
} from "../../model/browser-test-rules";
import type { BrowserTestsViewModel } from "../../view-models/use-browser-tests-view-model";
import { InfoIcon } from "./pipeline-glyphs";

/**
 * The "Browser tests" card above the commits: whether the dev branch has the
 * starter Playwright pack that the Verify stage's checks — page loads, links,
 * accessibility and the visual screenshots — run from, and the one button that
 * opens a pull request adding what is missing.
 *
 * Calm on purpose. An installed pack is one muted line; a backend repository
 * gets no card at all; nothing shows while it loads or if the read failed.
 * The pull request is reached in the product, on the Pull requests tab.
 */
export function BrowserTestsCard({
  view,
  onOpenPullRequest,
}: Readonly<{
  view: BrowserTestsViewModel;
  /** Opens the Pull requests tab on a number; absent when that tab is not offered. */
  onOpenPullRequest?: (pullRequestNumber: number) => void;
}>) {
  const titleId = useId();
  const state = browserTestsCardState(view.status === "ready" ? view.browserTests : null);
  if (state === "hidden") return null;
  if (state === "installed" && !view.added) {
    return (
      <p className="pipe-tests pipe-tests--installed" data-browser-tests>
        <InfoIcon />
        <span>{INSTALLED_LINE}</span>
      </p>
    );
  }
  return (
    <section className="pipe-tests" aria-labelledby={titleId} data-browser-tests>
      <h3 id={titleId} className="pipe-tests__title">Browser tests</h3>
      <BrowserTestsBody view={view} onOpenPullRequest={onOpenPullRequest} />
    </section>
  );
}

type OpenPullRequest = ((pullRequestNumber: number) => void) | undefined;

function BrowserTestsBody({
  view,
  onOpenPullRequest,
}: Readonly<{ view: BrowserTestsViewModel; onOpenPullRequest: OpenPullRequest }>) {
  const branch = view.browserTests?.branch ?? "dev";
  if (view.added) {
    return (
      <>
        <p className="pipe-tests__done" role="status">
          {openedLabel(view.added, branch)}.{" "}
          <PullRequestLink number={view.added.pullRequestNumber} onOpen={onOpenPullRequest} />
        </p>
        <Notes notes={view.added.notes} />
      </>
    );
  }
  return (
    <>
      <p className="pipe-tests__lead">
        The Verify stage runs these against the deployed site. Missing on {branch}:
      </p>
      <ul className="pipe-tests__missing">
        {missingChecks(view.browserTests?.missingFiles ?? []).map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
      <AddAction view={view} branch={branch} />
      <AddFailure error={view.addError} onOpenPullRequest={onOpenPullRequest} />
    </>
  );
}

/** The button when this person may add the pack; the server's reason when not. */
function AddAction({ view, branch }: Readonly<{ view: BrowserTestsViewModel; branch: string }>) {
  const status = view.browserTests;
  if (!status?.canAdd) {
    return status?.reason ? <p className="pipe-tests__reason">{status.reason}</p> : null;
  }
  return (
    <div className="pipe-tests__actions">
      <button
        type="button"
        className="pipe-approve"
        aria-busy={view.adding}
        disabled={view.adding}
        onClick={view.add}
      >
        {view.adding ? "Opening pull request…" : ADD_BUTTON_LABEL}
      </button>
      <span className="pipe-tests__hint">Opens a pull request into {branch}.</span>
    </div>
  );
}

function AddFailure({
  error,
  onOpenPullRequest,
}: Readonly<{ error: BrowserTestsError | null; onOpenPullRequest: OpenPullRequest }>) {
  if (!error) return null;
  return (
    <p className="pipe-banner pipe-banner--danger pipe-tests__error" role="alert">
      <InfoIcon />
      <span>
        {error.message}
        {error.pullRequestNumber !== null && (
          <>
            {" "}
            <PullRequestLink number={error.pullRequestNumber} onOpen={onOpenPullRequest} />
          </>
        )}
        {error.signInHref && (
          <>
            {" "}
            <a className="pipe-link" href={error.signInHref}>
              Sign in again
            </a>
          </>
        )}
      </span>
    </p>
  );
}

/** An in-app link to the Pull requests tab, focused on the number. Never GitHub. */
function PullRequestLink({
  number,
  onOpen,
}: Readonly<{ number: number; onOpen?: (pullRequestNumber: number) => void }>) {
  if (!onOpen) return null;
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onOpen(number);
  };
  return (
    <a className="pipe-link" href="#pulls" onClick={open}>
      View pull request #{number}
    </a>
  );
}

function Notes({ notes }: Readonly<{ notes: readonly string[] }>) {
  if (notes.length === 0) return null;
  return (
    <ul className="pipe-tests__notes" aria-label="Notes">
      {notes.map((note, index) => {
        const { text, code } = splitNote(note);
        return (
          <li key={index}>
            {text}
            {code && (
              <pre className="pipe-tests__code">
                <code>{code}</code>
              </pre>
            )}
          </li>
        );
      })}
    </ul>
  );
}
