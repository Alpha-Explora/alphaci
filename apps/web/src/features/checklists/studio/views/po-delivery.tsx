"use client";

import "./po-studio.css";

import { FormDialog } from "@/features/groups/workspace";

import {
  coveredRepositoryState,
  deliveredBannerTitle,
  deliveredRepositoryDetail,
  mergeAllConfirmText,
  mergeAllErrorTitle,
  mergeAllFailures,
  mergeAllRowState,
  mergeAllSummary,
} from "../../model/iteration-rules";
import type { CurrentIteration, MergeAllError, MergeAllResult } from "../../model/iteration-types";
import type { QaPromotionIteration } from "../../model/qa-promotion-types";
import type { PoDeliveryViewModel } from "../view-models/use-po-delivery-view-model";
import { CheckIcon, MergeIcon } from "./studio-icons";

/* PO Studio's delivery: the delivered banner once the Project's iteration
 * reached main, and — before that — each covered repository's stored state
 * with "Merge all repositories" for a Product owner or admin. */

function bannerTitle(delivered: CurrentIteration | null, fallback: QaPromotionIteration | null): string {
  if (delivered) return deliveredBannerTitle(delivered.iteration);
  if (fallback) return deliveredBannerTitle({ ...fallback, deliveredByLogin: null });
  return "Delivered to production";
}

/**
 * "Iteration 3 delivered on 14 Oct 2026 by @ana", then each repository and
 * how it reached main. Without the iterations route (the promotion status
 * alone said "delivered"), the title only, from the promotion's iteration.
 */
export function PoDeliveredBanner({
  current,
  fallback,
}: Readonly<{ current: CurrentIteration | null; fallback: QaPromotionIteration | null }>) {
  const delivered = current?.iteration.status === "delivered" ? current : null;
  return (
    <div className="po-delivered" role="status">
      <p className="po-delivered__title">
        <span className="po-delivered__mark" aria-hidden="true">
          <CheckIcon />
        </span>
        {bannerTitle(delivered, fallback)}
      </p>
      <p className="po-delivered__text">Every repository&apos;s main holds the uat heads QA signed off. Nothing here can change any more.</p>
      {delivered && delivered.deliveredRepositories.length > 0 ? (
        <ul className="po-delivery__rows" aria-label="How each repository reached main">
          {delivered.deliveredRepositories.map((repository) => (
            <li key={repository.projectId} className="po-delivery__row" data-tone="success">
              <span className="po-delivery__name">{repository.repoFullName}</span>
              <span className="po-delivery__state po-delivery__state--detail">{deliveredRepositoryDetail(repository)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Each covered repository on the active iteration: in main already, or not yet (stored, so a reload keeps it). */
function CoveredRows({ current }: Readonly<{ current: CurrentIteration }>) {
  if (current.coveredRepositories.length === 0) return null;
  return (
    <ul className="po-delivery__rows" aria-label="Repositories in this iteration">
      {current.coveredRepositories.map((repository) => {
        const state = coveredRepositoryState(repository);
        return (
          <li key={repository.projectId} className="po-delivery__row" data-tone={state.tone}>
            <span className="po-delivery__name">{repository.repoFullName}</span>
            <span className="po-delivery__state">{state.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ResultRows({ result }: Readonly<{ result: MergeAllResult }>) {
  return (
    <ul className="po-delivery__rows" aria-label="Merge results">
      {result.repositories.map((row) => {
        const state = mergeAllRowState(row);
        return (
          <li key={row.projectId} className="po-delivery__row" data-tone={state.tone}>
            <span className="po-delivery__name">{row.repoFullName}</span>
            <span className="po-delivery__state">{state.label}</span>
            {row.message && state.tone === "danger" ? <span className="po-delivery__message">{row.message}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

function ResultOutcome({ vm, result }: Readonly<{ vm: PoDeliveryViewModel; result: MergeAllResult }>) {
  const failed = mergeAllFailures(result).length > 0;
  return (
    <div className="po-delivery__outcome" data-tone={failed ? "danger" : "success"}>
      <p className="po-delivery__outcome-title">{mergeAllSummary(result)}</p>
      <ResultRows result={result} />
      <div className="po-delivery__actions">
        {failed ? (
          <button
            type="button"
            className="primary-button po-delivery__retry"
            disabled={vm.mergeState !== "idle"}
            onClick={() => void vm.retry()}
          >
            {vm.mergeState === "merging" ? "Merging…" : "Retry the rest"}
          </button>
        ) : null}
        <button type="button" className="qa-text-button" onClick={vm.dismissOutcome}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

function ErrorOutcome({ vm, error }: Readonly<{ vm: PoDeliveryViewModel; error: MergeAllError }>) {
  return (
    <div className="po-delivery__outcome" data-tone="danger">
      <p className="po-delivery__outcome-title">{mergeAllErrorTitle(error.kind)}</p>
      <p className="po-delivery__outcome-text">{error.message}</p>
      {error.reasons.length > 0 ? (
        <ul className="po-delivery__reasons">
          {error.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      <div className="po-delivery__actions">
        {error.signIn ? (
          <a className="ghost-button" href={vm.signInHref}>
            Sign in again
          </a>
        ) : null}
        <button type="button" className="qa-text-button" onClick={vm.dismissOutcome}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

/** How the last Merge all ended: a live region, so the answer is announced. */
function MergeAllOutcomeView({ vm }: Readonly<{ vm: PoDeliveryViewModel }>) {
  const outcome = vm.outcome;
  return (
    <div className="po-delivery__live" role="status" aria-live="polite">
      {outcome?.kind === "result" ? <ResultOutcome vm={vm} result={outcome.result} /> : null}
      {outcome?.kind === "error" ? <ErrorOutcome vm={vm} error={outcome.error} /> : null}
    </div>
  );
}

/**
 * The active iteration's delivery: each covered repository's stored state,
 * Merge all repositories (confirmed first) for those the server lets merge,
 * and how the last attempt ended. Nothing at all on a backend without
 * iterations, or before QA signed the Project off as Approved.
 */
export function PoMergeAll({ vm, projectName }: Readonly<{ vm: PoDeliveryViewModel; projectName: string }>) {
  const current = vm.iteration.current;
  if (!current || current.iteration.status !== "active") return null;
  if (current.coveredRepositories.length === 0 && !vm.outcome) return null;
  return (
    <section className="po-delivery" aria-label="Delivery to main">
      <p className="qa-toolbar__label">Delivery to main</p>
      <CoveredRows current={current} />
      {/* After an attempt, its outcome (and Retry) takes the button's place until dismissed. */}
      {vm.canMergeAll && !vm.outcome ? (
        <button
          type="button"
          className="primary-button po-delivery__merge"
          disabled={vm.mergeState !== "idle"}
          onClick={vm.openConfirm}
        >
          <MergeIcon />
          {vm.mergeState === "merging" ? "Merging…" : "Merge all repositories"}
        </button>
      ) : null}
      <MergeAllOutcomeView vm={vm} />
      {vm.canMergeAll ? (
        <FormDialog
          open={vm.dialogOpen}
          onClose={vm.cancelConfirm}
          title="Merge all repositories into main?"
          description={mergeAllConfirmText(projectName, vm.pending)}
          submitLabel="Merge all repositories"
          submitting={vm.mergeState === "merging"}
          error={vm.dialogError}
          onSubmit={() => void vm.confirmMergeAll()}
        >
          <ul className="po-delivery__rows" aria-label="Repositories to merge">
            {vm.pending.map((repository) => (
              <li key={repository.projectId} className="po-delivery__row" data-tone="neutral">
                <span className="po-delivery__name">{repository.repoFullName}</span>
                <span className="po-delivery__state">uat → main</span>
              </li>
            ))}
          </ul>
        </FormDialog>
      ) : null}
    </section>
  );
}
