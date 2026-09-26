"use client";

import { useEffect, useRef, useState } from "react";

import type { AppRole } from "@/shared/api/contracts";

import { qaRunsRepository } from "../../data/qa-runs-repository";
import { qaSignInHref } from "../../model/qa-automation-rules";
import {
  canOfferMerge,
  mergeDisabledReason,
  mergeErrorClosesDialog,
  mergeErrorRefreshesStatus,
  normalizePromotionMerge,
  normalizePromotionStatus,
  promotionMergeError,
} from "../../model/qa-promotion-rules";
import type {
  QaPromotionMergeError,
  QaPromotionMergeResult,
  QaPromotionStatus,
} from "../../model/qa-promotion-types";
import { errorStatus } from "../../model/wire-readers";

/** `unavailable`: this backend has no promotion route (404), so there is no card. */
export type QaPromotionLoadStatus = "loading" | "ready" | "error" | "unavailable";

/** The merge flow: nothing, the confirmation open, or the request in flight. */
export type QaPromotionMergeState = "idle" | "confirming" | "merging";

/** How the last merge ended, shown in the card until dismissed. */
export type QaPromotionOutcome =
  | { kind: "merged"; result: QaPromotionMergeResult; headSha: string | null }
  | { kind: "refused"; result: QaPromotionMergeResult }
  | { kind: "error"; error: QaPromotionMergeError };

export interface QaPromotionViewModel {
  status: QaPromotionLoadStatus;
  /** The last status read. Kept on screen while a refresh is in flight. */
  data: QaPromotionStatus | null;
  /** Safe to render. Never an API detail. */
  error: string | null;
  /** A refresh is in flight behind the status on screen. */
  refreshing: boolean;
  /** Whether to draw "Merge to main" at all (server's canMerge AND role). */
  canMerge: boolean;
  /** Why the button is disabled, or null when it can be pressed. */
  disabledReason: string | null;
  mergeState: QaPromotionMergeState;
  /** A failure worth retrying, shown inside the open confirmation. */
  dialogError: string | null;
  outcome: QaPromotionOutcome | null;
  /** Where "Sign in again" goes: login, then back to this project. */
  signInHref: string;
  openConfirm: () => void;
  cancelConfirm: () => void;
  confirmMerge: () => Promise<void>;
  dismissOutcome: () => void;
  reload: () => void;
}

interface LoadResult {
  key: string;
  /** Which load answered, so a newer request shows as "refreshing". */
  nonce: number;
  data: QaPromotionStatus | null;
  error: string | null;
  unavailable: boolean;
}

const LOAD_ERROR = "Production readiness could not be loaded. Try again in a moment.";

function loadStatus(result: LoadResult | null): QaPromotionLoadStatus {
  if (!result) return "loading";
  if (result.unavailable) return "unavailable";
  return result.data ? "ready" : "error";
}

function failedLoad(key: string, nonce: number, cause: unknown, previous: LoadResult | null): LoadResult {
  if (errorStatus(cause) === 404) return { key, nonce, data: null, error: null, unavailable: true };
  // A failed refresh keeps what was on screen; only a first load shows the error.
  const kept = previous?.key === key ? previous.data : null;
  return { key, nonce, data: kept, error: kept ? null : LOAD_ERROR, unavailable: false };
}

/** The uat commit the last successful merge promoted, so it is not offered twice. */
function mergedHead(outcome: QaPromotionOutcome | null): string | null {
  return outcome?.kind === "merged" ? outcome.headSha : null;
}

/** Whether to offer the button, and why it is disabled — from the status on screen. */
function mergeOffer(
  data: QaPromotionStatus | null,
  appRole: AppRole | null | undefined,
  outcome: QaPromotionOutcome | null,
): { offer: boolean; disabledReason: string | null } {
  if (!data) return { offer: false, disabledReason: null };
  return { offer: canOfferMerge(data, appRole), disabledReason: mergeDisabledReason(data, mergedHead(outcome)) };
}

/**
 * Re-read the status when `watch` changes between two known values — the
 * studio passes the selected run's id, status and sign-off, so signing off or
 * reopening refreshes readiness. Adjusted during render (not in an effect):
 * React's documented way to react to a changed input.
 */
function useWatchedReload(watch: string | null, reload: () => void) {
  const [seen, setSeen] = useState(watch);
  if (watch !== seen) {
    setSeen(watch);
    if (seen !== null && watch !== null) reload();
  }
}

/**
 * ViewModel for QA Studio's "Ready for production" card: whether uat's
 * current head is approved for main, and — for Team leads and Admins the
 * server allows — merging it. The server re-checks everything on merge; the
 * card only explains the answer, including GitHub's own refusal, verbatim.
 */
export function useQaPromotionViewModel(options: {
  projectId: string;
  enabled: boolean;
  appRole: AppRole | null | undefined;
  /** Changes when the studio's run is signed off or reopened. */
  watch: string | null;
}): QaPromotionViewModel {
  const { projectId, enabled, appRole, watch } = options;
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const [mergeState, setMergeState] = useState<QaPromotionMergeState>("idle");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<QaPromotionOutcome | null>(null);
  const requestRef = useRef(0);
  // Keyed by project only: a refresh keeps the card on screen until it answers.
  const key = projectId;
  const reload = () => setNonce((value) => value + 1);
  useWatchedReload(watch, reload);

  useEffect(() => {
    if (!enabled || !projectId) return;
    requestRef.current += 1;
    const requestId = requestRef.current;
    qaRunsRepository
      .promotion(projectId)
      .then((wire) => {
        if (requestId !== requestRef.current) return;
        setResult({ key, nonce, data: normalizePromotionStatus(wire), error: null, unavailable: false });
      })
      .catch((cause: unknown) => {
        if (requestId !== requestRef.current) return;
        setResult((previous) => failedLoad(key, nonce, cause, previous));
      });
  }, [enabled, projectId, key, nonce]);

  const current = result?.key === key ? result : null;
  const data = current?.data ?? null;
  const { offer, disabledReason } = mergeOffer(data, appRole, outcome);

  function openConfirm() {
    if (!offer || disabledReason || mergeState !== "idle") return;
    setDialogError(null);
    setMergeState("confirming");
  }

  function settle(next: QaPromotionOutcome, refresh: boolean) {
    setOutcome(next);
    setMergeState("idle");
    if (refresh) reload();
  }

  async function confirmMerge() {
    if (!offer || disabledReason || mergeState !== "confirming") return;
    const headSha = data?.headSha ?? null;
    setMergeState("merging");
    setDialogError(null);
    try {
      const merged = normalizePromotionMerge(await qaRunsRepository.mergePromotion(projectId));
      settle(merged.merged ? { kind: "merged", result: merged, headSha } : { kind: "refused", result: merged }, true);
    } catch (cause) {
      const error = promotionMergeError(cause);
      if (!mergeErrorClosesDialog(error)) {
        setDialogError(error.message);
        setMergeState("confirming");
        return;
      }
      settle({ kind: "error", error }, mergeErrorRefreshesStatus(error));
    }
  }

  return {
    status: enabled ? loadStatus(current) : "unavailable",
    data,
    error: current?.error ?? null,
    refreshing: Boolean(current && current.nonce !== nonce),
    canMerge: offer,
    disabledReason,
    mergeState,
    dialogError,
    outcome,
    signInHref: qaSignInHref(projectId),
    openConfirm,
    cancelConfirm: () => {
      if (mergeState === "merging") return;
      setMergeState("idle");
      setDialogError(null);
    },
    confirmMerge,
    dismissOutcome: () => setOutcome(null),
    reload,
  };
}
