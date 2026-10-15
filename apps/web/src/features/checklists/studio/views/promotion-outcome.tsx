"use client";

import type { ReactNode } from "react";

import { MERGE_REFUSED_HINT, mergeErrorTitle, mergedLabel } from "../../model/qa-promotion-rules";
import type { QaPromotionMergeError, QaPromotionMergeResult } from "../../model/qa-promotion-types";
import type { QaPromotionViewModel } from "../view-models/use-qa-promotion-view-model";

/**
 * Which pull request this is, as text. It names the PR without sending anyone to
 * GitHub: the Studio's readers work here, and the Pull requests tab is not one
 * every role of this screen can open.
 */
export function PullRequestRef({ label }: Readonly<{ label: string }>) {
  return <span className="qa-promo__pr">{label}</span>;
}

function OutcomeFrame({
  tone,
  title,
  onDismiss,
  children,
}: Readonly<{ tone: "success" | "warning" | "danger"; title: string; onDismiss: () => void; children: ReactNode }>) {
  return (
    <div className="qa-promo-outcome" data-tone={tone}>
      <p className="qa-promo-outcome__title">{title}</p>
      {children}
      <button type="button" className="qa-text-button qa-promo-outcome__dismiss" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}

function Merged({ result, targetBranch, onDismiss }: Readonly<{ result: QaPromotionMergeResult; targetBranch: string; onDismiss: () => void }>) {
  return (
    <OutcomeFrame tone="success" title={`Merged into ${targetBranch}`} onDismiss={onDismiss}>
      <p className="qa-promo-outcome__text">{mergedLabel(result, targetBranch)}</p>
      {result.pullRequest ? (
        <PullRequestRef label={`Pull request #${result.pullRequest.number}`} />
      ) : null}
    </OutcomeFrame>
  );
}

/** GitHub said no: its words, verbatim, and what usually unblocks it. */
function Refused({ result, onDismiss }: Readonly<{ result: QaPromotionMergeResult; onDismiss: () => void }>) {
  return (
    <OutcomeFrame tone="warning" title="GitHub refused the merge" onDismiss={onDismiss}>
      <blockquote className="qa-promo-outcome__quote">{result.message}</blockquote>
      <p className="qa-promo-outcome__text">{MERGE_REFUSED_HINT}</p>
      {result.pullRequest ? (
        <PullRequestRef label={`Pull request #${result.pullRequest.number}`} />
      ) : null}
    </OutcomeFrame>
  );
}

function Failed({
  error,
  signInHref,
  onDismiss,
}: Readonly<{ error: QaPromotionMergeError; signInHref: string; onDismiss: () => void }>) {
  return (
    <OutcomeFrame tone="danger" title={mergeErrorTitle(error.kind)} onDismiss={onDismiss}>
      <p className="qa-promo-outcome__text">{error.message}</p>
      {error.reasons.length > 0 ? (
        <ul className="qa-promo-outcome__reasons">
          {error.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      {error.signIn ? (
        <a className="ghost-button qa-promo-outcome__signin" href={signInHref}>
          Sign in again
        </a>
      ) : null}
    </OutcomeFrame>
  );
}

/**
 * Nothing to merge because main already holds this commit: a success, never
 * an error. The server's sentence, verbatim, and no "a reviewer must approve".
 */
function AlreadyInMain({
  result,
  targetBranch,
  onDismiss,
}: Readonly<{ result: QaPromotionMergeResult; targetBranch: string; onDismiss: () => void }>) {
  return (
    <OutcomeFrame tone="success" title={`Already in ${targetBranch}`} onDismiss={onDismiss}>
      <p className="qa-promo-outcome__text">{result.message}</p>
    </OutcomeFrame>
  );
}

/**
 * A refusal is "already in main" when the reply says so, or when the status
 * read after it says this repository's main now holds the head.
 */
function refusedAsAlreadyInMain(vm: QaPromotionViewModel, result: QaPromotionMergeResult): boolean {
  return result.alreadyInMain || vm.data?.repositoryDelivered === true;
}

function OutcomeBody({ vm, targetBranch }: Readonly<{ vm: QaPromotionViewModel; targetBranch: string }>) {
  const outcome = vm.outcome;
  if (!outcome) return null;
  if (outcome.kind === "merged") {
    return <Merged result={outcome.result} targetBranch={targetBranch} onDismiss={vm.dismissOutcome} />;
  }
  if (outcome.kind === "refused" && refusedAsAlreadyInMain(vm, outcome.result)) {
    return <AlreadyInMain result={outcome.result} targetBranch={targetBranch} onDismiss={vm.dismissOutcome} />;
  }
  if (outcome.kind === "refused") return <Refused result={outcome.result} onDismiss={vm.dismissOutcome} />;
  return <Failed error={outcome.error} signInHref={vm.signInHref} onDismiss={vm.dismissOutcome} />;
}

/**
 * How the last merge ended. Always mounted as a live region, so the result is
 * announced; visible even when the card is folded, because it answers the
 * button the viewer just pressed.
 */
export function PromotionOutcome({ vm, targetBranch }: Readonly<{ vm: QaPromotionViewModel; targetBranch: string }>) {
  return (
    <div className="qa-promo__live" role="status" aria-live="polite">
      <OutcomeBody vm={vm} targetBranch={targetBranch} />
    </div>
  );
}
