"use client";

import "./po-studio.css";

import type { ReactNode } from "react";

import { FormDialog } from "@/features/groups/workspace";

import {
  deliveredBannerTitle,
  deliveredRepositoryDetail,
  mergeAllConfirmText,
  projectMergeConfirmText,
  mergeAllErrorTitle,
  mergeAllFailures,
  mergeAllRowState,
  mergeAllSummary,
} from "../../model/iteration-rules";
import type { CurrentIteration, MergeAllError, MergeAllResult } from "../../model/iteration-types";
import type { QaPromotionIteration } from "../../model/qa-promotion-types";
import type { PoDeliveryViewModel } from "../view-models/use-po-delivery-view-model";
import { useShowRepositories } from "../view-models/repository-visibility";
import { CheckIcon, MergeIcon } from "./studio-icons";

/* A Project's delivery: the delivered banner once its iteration reached main
 * (PO Studio's column); and the tab bar's Merge to main on a Project of two
 * or more repositories, which merges every one not in main yet, with its
 * confirmation and per-repository results. */

function bannerTitle(delivered: CurrentIteration | null, fallback: QaPromotionIteration | null): string {
  if (delivered) return deliveredBannerTitle(delivered.iteration);
  if (fallback) return deliveredBannerTitle({ ...fallback, deliveredByLogin: null });
  return "Delivered to production";
}

/**
 * "Iteration 3 delivered on 14 Oct 2026 by @ana", then each repository and
 * how it reached main, then what comes next (`next`: Start iteration N+1 for
 * a Product owner or admin). Without the iterations route (the promotion
 * status alone said "delivered"), the title only, from the promotion's
 * iteration.
 */
export function PoDeliveredBanner({
  current,
  fallback,
  next,
}: Readonly<{ current: CurrentIteration | null; fallback: QaPromotionIteration | null; next?: ReactNode }>) {
  const delivered = current?.iteration.status === "delivered" ? current : null;
  const showRepositories = useShowRepositories();
  return (
    <div className="po-delivered" role="status">
      <p className="po-delivered__title">
        <span className="po-delivered__mark" aria-hidden="true">
          <CheckIcon />
        </span>
        {bannerTitle(delivered, fallback)}
      </p>
      <p className="po-delivered__text">
        {showRepositories
          ? "Every repository's main holds the uat heads QA signed off. Nothing here can change any more."
          : "Main holds exactly what QA signed off. Nothing here can change any more."}
      </p>
      {showRepositories && delivered && delivered.deliveredRepositories.length > 0 ? (
        <ul className="po-delivery__rows" aria-label="How each repository reached main">
          {delivered.deliveredRepositories.map((repository) => (
            <li key={repository.projectId} className="po-delivery__row" data-tone="success">
              <span className="po-delivery__name">{repository.repoFullName}</span>
              <span className="po-delivery__state po-delivery__state--detail">{deliveredRepositoryDetail(repository)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {next ? <div className="po-delivered__next">{next}</div> : null}
    </div>
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

/** Why a merge stopped, without naming repositories: GitHub's reasons, once each. */
function FailureMessages({ result }: Readonly<{ result: MergeAllResult }>) {
  const messages = [...new Set(mergeAllFailures(result).map((row) => row.message).filter((m): m is string => Boolean(m)))];
  if (messages.length === 0) return null;
  return (
    <ul className="po-delivery__reasons">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

function ResultOutcome({ vm, result }: Readonly<{ vm: PoDeliveryViewModel; result: MergeAllResult }>) {
  const failed = mergeAllFailures(result).length > 0;
  const showRepositories = useShowRepositories();
  return (
    <div className="po-delivery__outcome" data-tone={failed ? "danger" : "success"}>
      <p className="po-delivery__outcome-title">{mergeAllSummary(result)}</p>
      {showRepositories ? <ResultRows result={result} /> : <FailureMessages result={result} />}
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

/**
 * How the last merge of every repository ended, with Retry after a partial
 * failure. Drawn inside the tab bar's merge live region, so it is announced.
 */
export function MergeAllOutcome({ vm }: Readonly<{ vm: PoDeliveryViewModel }>) {
  const outcome = vm.outcome;
  if (outcome?.kind === "result") return <ResultOutcome vm={vm} result={outcome.result} />;
  if (outcome?.kind === "error") return <ErrorOutcome vm={vm} error={outcome.error} />;
  return null;
}

/**
 * The tab bar's Merge to main when it merges every repository not in main
 * yet (`canMergeAll`): confirmed first, for those the server lets merge.
 */
export function MergeAllToMain({ vm }: Readonly<{ vm: PoDeliveryViewModel }>) {
  if (!vm.canMergeAll) return null;
  return (
    <button
      type="button"
      className="primary-button qa-promo__merge"
      disabled={vm.mergeState !== "idle"}
      onClick={vm.openConfirm}
    >
      <MergeIcon />
      {vm.mergeState === "merging" ? "Merging…" : "Merge to main"}
    </button>
  );
}

/** The confirmation of a merge of every repository: each one named before anything merges. */
export function MergeAllDialog({ vm, projectName }: Readonly<{ vm: PoDeliveryViewModel; projectName: string }>) {
  const showRepositories = useShowRepositories();
  if (!vm.canMergeAll) return null;
  return (
    <FormDialog
      open={vm.dialogOpen}
      onClose={vm.cancelConfirm}
      portal
      title={showRepositories ? "Merge every repository into main?" : `Merge ${projectName} into main?`}
      description={showRepositories ? mergeAllConfirmText(projectName, vm.pending) : projectMergeConfirmText(projectName)}
      submitLabel="Merge to main"
      submitting={vm.mergeState === "merging"}
      error={vm.dialogError}
      onSubmit={() => void vm.confirmMergeAll()}
    >
      {showRepositories ? (
        <ul className="po-delivery__rows" aria-label="Repositories to merge">
          {vm.pending.map((repository) => (
            <li key={repository.projectId} className="po-delivery__row" data-tone="neutral">
              <span className="po-delivery__name">{repository.repoFullName}</span>
              <span className="po-delivery__state">uat → main</span>
            </li>
          ))}
        </ul>
      ) : null}
    </FormDialog>
  );
}
