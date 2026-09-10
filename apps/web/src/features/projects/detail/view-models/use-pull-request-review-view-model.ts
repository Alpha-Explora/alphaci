"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getProjectPullRequestDetail,
  mergeProjectPullRequest,
  type PullRequestCheck,
  type PullRequestDetail,
  type PullRequestDetailResponse,
} from "../data/project-workspace-api";

import { apiErrorReason } from "../model/api-error-reason";
import type { ProjectStatus } from "../../model/projects-types";
/*
 * Re-exported so a View can name what it renders without importing from
 * `data/`. The boundary checks reject any views -> data edge, type-only or
 * not, and they are right to: the ViewModel owns this contract.
 */
export type { PullRequestCheck, PullRequestDetail, PullRequestDetailResponse };

export interface PullRequestReviewViewModel {
  status: ProjectStatus;
  detail: PullRequestDetailResponse | null;
  error: string | null;
  merging: boolean;
  /** GitHub's answer to the last merge attempt, refusal or success. */
  mergeMessage: string | null;
  mergeFailed: boolean;
  merge: () => Promise<void>;
  reload: () => void;
}

/**
 * One pull request: its checks, whether GitHub will merge it, and merging it.
 *
 * This exists so deciding about a pull request does not mean leaving for
 * GitHub. The tab used to offer a link reading "Review and merge on GitHub",
 * which is an admission that the product tracked the pull request and then
 * handed the actual decision somewhere else.
 *
 * Loaded on expand, never polled: three GitHub reads sit behind it, and the
 * rate limit is shared by the whole organisation.
 */
export function usePullRequestReviewViewModel(options: {
  projectId: string;
  pullNumber: number;
  /** False while the row is collapsed, so nothing is fetched unasked. */
  enabled: boolean;
}): PullRequestReviewViewModel {
  const { projectId, pullNumber, enabled } = options;

  const [status, setStatus] = useState<ProjectStatus>("loading");
  const [detail, setDetail] = useState<PullRequestDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeMessage, setMergeMessage] = useState<string | null>(null);
  const [mergeFailed, setMergeFailed] = useState(false);

  const load = useCallback(() => {
    return getProjectPullRequestDetail(projectId, pullNumber)
      .then((result) => {
        setDetail(result);
        setError(null);
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        setError(
          apiErrorReason(cause, "This pull request could not be read."),
        );
        setStatus("error");
      });
  }, [projectId, pullNumber]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  const reload = useCallback(() => {
    setStatus("loading");
    void load();
  }, [load]);

  /**
   * Ask GitHub to merge, and keep whatever it says.
   *
   * A refusal arrives as `merged: false` with GitHub's own sentence — "at
   * least 1 approving review is required" — which is the answer, not an error.
   * Repeating it is the entire reason for merging here rather than there.
   *
   * The detail is reloaded either way: a successful merge changes the state to
   * merged, and a refusal often means the checks moved since the row loaded.
   */
  const merge = useCallback(async () => {
    setMerging(true);
    setMergeMessage(null);
    setMergeFailed(false);
    try {
      const result = await mergeProjectPullRequest(projectId, pullNumber);
      setMergeMessage(result.message);
      setMergeFailed(!result.merged);
      await load();
    } catch (cause: unknown) {
      setMergeMessage(
        apiErrorReason(cause, "The merge request could not be sent."),
      );
      setMergeFailed(true);
    } finally {
      setMerging(false);
    }
  }, [projectId, pullNumber, load]);

  return {
    status,
    detail,
    error,
    merging,
    mergeMessage,
    mergeFailed,
    merge,
    reload,
  };
}
