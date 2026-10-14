"use client";

import "./pipeline-browser-tests.css";

import Link from "next/link";
import { useId, type MouseEvent, type ReactNode } from "react";

import {
  ADD_BUTTON_LABEL,
  INSTALLED_LINE,
  VISUAL_PROMOTE_LINE,
  VISUAL_UPDATE_HINT,
  VISUAL_UPDATE_LABEL,
  browserTestsCardState,
  missingChecks,
  openedLabel,
  splitNote,
  visualOffNotice,
  type BrowserTestsError,
  type VisualOffNotice,
} from "../../model/browser-test-rules";
import { UPDATE_PR_ROLE_NOTE, type WorkflowUpdateAccess } from "../../model/project-detail-tab-rules";
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
 *
 * When the repository's verify workflow takes no screenshots (the status's
 * `visual`), the card says so and how to turn it on — the Pipeline tab's
 * Configuration view (once the Workflow tab) and its
 * update pull request, or a promotion to uat. An older backend sends no
 * `visual`, and the card reads as it always did.
 */
export function BrowserTestsCard({
  view,
  onOpenPullRequest,
  workflowAccess = "unavailable",
  onOpenWorkflow,
  workflowHref,
}: Readonly<{
  view: BrowserTestsViewModel;
  /** Opens the Pull requests tab on a number; absent when that tab is not offered. */
  onOpenPullRequest?: (pullRequestNumber: number) => void;
  /** Whether this viewer may be sent to the workflow update pull request. */
  workflowAccess?: WorkflowUpdateAccess;
  /** Opens Pipeline on Configuration, where the update pull request is previewed and opened. */
  onOpenWorkflow?: () => void;
  /** Without `onOpenWorkflow`: another repository's page, on its Pipeline configuration. */
  workflowHref?: string;
}>) {
  const titleId = useId();
  const state = browserTestsCardState(view.status === "ready" ? view.browserTests : null);
  if (state === "hidden") return null;
  const notice = visualOffNotice(view.visual);
  const installedOnly = state === "installed" && !view.added;
  if (installedOnly && !notice) {
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
      {installedOnly ? (
        <p className="pipe-tests__lead">{INSTALLED_LINE}</p>
      ) : (
        <BrowserTestsBody view={view} onOpenPullRequest={onOpenPullRequest} />
      )}
      <VisualOff notice={notice} way={{ access: workflowAccess, onOpenWorkflow, workflowHref }} />
    </section>
  );
}

/**
 * "Visual testing is off in this repository's workflow", and the way to turn
 * it on: the Pipeline configuration's update pull request when dev is off (or, for a
 * role that cannot open it, who can), a promotion when only uat is.
 */
function VisualOff({ notice, way }: Readonly<{ notice: VisualOffNotice | null; way: WorkflowWay }>) {
  if (!notice) return null;
  return (
    <div className="pipe-tests__visual" data-visual-off>
      <p className="pipe-tests__visual-line">{notice.line}</p>
      <VisualFix fix={notice.fix} way={way} />
    </div>
  );
}

interface WorkflowWay {
  access: WorkflowUpdateAccess;
  /** Opens this page's Pipeline tab on Configuration. */
  onOpenWorkflow?: () => void;
  /** Another repository's page, opened on its Pipeline configuration. In the product, never GitHub. */
  workflowHref?: string;
}

function VisualFix({ fix, way }: Readonly<{ fix: VisualOffNotice["fix"]; way: WorkflowWay }>) {
  if (fix === "promote") return <p className="pipe-tests__reason">{VISUAL_PROMOTE_LINE}</p>;
  if (fix !== "update-workflow") return null;
  if (way.access === "role") return <p className="pipe-tests__reason">{UPDATE_PR_ROLE_NOTE}</p>;
  if (way.access !== "open") return null;
  return <UpdateWorkflowAction way={way} />;
}

function UpdateWorkflowAction({ way }: Readonly<{ way: WorkflowWay }>) {
  let action: ReactNode = null;
  if (way.onOpenWorkflow) {
    action = (
      <button type="button" className="pipe-approve" onClick={way.onOpenWorkflow}>
        {VISUAL_UPDATE_LABEL}
      </button>
    );
  } else if (way.workflowHref) {
    action = (
      <Link className="pipe-approve" href={way.workflowHref}>
        {VISUAL_UPDATE_LABEL}
      </Link>
    );
  }
  if (!action) return null;
  return (
    <div className="pipe-tests__actions">
      {action}
      <span className="pipe-tests__hint">{VISUAL_UPDATE_HINT}</span>
    </div>
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
