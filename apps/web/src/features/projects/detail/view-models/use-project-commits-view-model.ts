"use client";

import { useEffect, useRef, useState } from "react";

import { projectsRepository } from "../../data/projects-repository";
import type { ProjectStatus } from "../../model/projects-types";
import {
  appendCommitsPage,
  branchOptions,
  COMMITS_PAGE_SIZE,
  normalizeCommitsPage,
  type CommitRow,
  type CommitsPage,
} from "../model/commit-list-rules";
import { githubReadFailure, needsGithubSignIn, type GithubReadFailure } from "../model/github-read-failure";

export interface ProjectCommitsViewModel {
  status: ProjectStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  /** Set when GitHub needs the viewer to sign in again: where the link goes. */
  signInHref: string | null;
  /** The branch the shown commits are on (the server's default until one is picked). */
  branch: string | null;
  /** The selector's options: dev, uat, main as the repository has them. */
  branchOptions: string[];
  /** Newest first, every page loaded so far. */
  rows: CommitRow[];
  /** When the shown rows were read: the base for their "5m ago". */
  readAt: number;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreError: string | null;
  selectBranch: (branch: string) => void;
  loadMore: () => Promise<void>;
  retry: () => void;
}

/** Results are keyed by what was asked for; a mismatched key reads as loading. */
interface LoadedState {
  key: string;
  projectId: string;
  page: CommitsPage;
  readAt: number;
}

interface FailedState {
  key: string;
  failure: GithubReadFailure;
}

const EMPTY_PAGE: CommitsPage = { branch: null, branches: [], items: [], next: null };

function readFailure(cause: unknown, projectId: string): GithubReadFailure {
  return githubReadFailure(cause, {
    projectId,
    subject: "show this repository's commits",
    notFound: "This repository is not available to you, or it no longer exists.",
    fallback: "Commits could not be read from GitHub.",
  });
}

const LOAD_MORE_ERROR = "Unable to load older commits. Try again in a moment.";

function queryKey(projectId: string, branch: string | null, attempt: number): string {
  return JSON.stringify([projectId, branch, attempt]);
}

function statusFor(key: string, loaded: LoadedState | null, failed: FailedState | null): ProjectStatus {
  if (loaded?.key === key) return "ready";
  if (failed?.key === key) return "error";
  return "loading";
}

interface DerivedCommits {
  status: ProjectStatus;
  page: CommitsPage;
  failure: GithubReadFailure | null;
  branch: string | null;
  /** The last branch list read for this project, even while another branch loads. */
  knownBranches: string[];
  readAt: number;
}

/** What the current key reads as, from the keyed results. */
function deriveCommits(input: {
  key: string;
  projectId: string;
  chosenBranch: string | null;
  loaded: LoadedState | null;
  failed: FailedState | null;
}): DerivedCommits {
  const { key, projectId, chosenBranch, loaded, failed } = input;
  const status = statusFor(key, loaded, failed);
  const page = status === "ready" && loaded ? loaded.page : EMPTY_PAGE;
  const sameProject = loaded !== null && loaded.projectId === projectId;
  return {
    status,
    page,
    failure: status === "error" && failed ? failed.failure : null,
    branch: page.branch ?? chosenBranch,
    knownBranches: sameProject ? loaded.page.branches : [],
    readAt: loaded ? loaded.readAt : 0,
  };
}

/**
 * ViewModel for the Commits tab: the branch the tab was opened on (else the
 * server's default) on first open, a picked branch afterwards, older pages on "Load more" with the
 * cursor passed back unchanged.
 *
 * The effect only starts a request; results land keyed by the branch they
 * were asked for, so picking another branch reads as loading on the same
 * render without a synchronous reset, and a slow answer for the previous
 * branch cannot overwrite the new one (the request counter).
 */
export function useProjectCommitsViewModel(options: {
  projectId: string;
  /** The branch to open on (a deep link); without one, the server's default. */
  initialBranch?: string | null;
}): ProjectCommitsViewModel {
  const { projectId } = options;
  const [chosenBranch, setChosenBranch] = useState<string | null>(options.initialBranch ?? null);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<LoadedState | null>(null);
  const [failed, setFailed] = useState<FailedState | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const req = useRef(0);
  const key = queryKey(projectId, chosenBranch, attempt);

  useEffect(() => {
    if (!projectId) return;
    req.current += 1;
    const id = req.current;
    projectsRepository
      .commits(projectId, { branch: chosenBranch, limit: COMMITS_PAGE_SIZE })
      .then((response) => {
        if (id !== req.current) return;
        setLoaded({ key, projectId, page: normalizeCommitsPage(response), readAt: Date.now() });
      })
      .catch((cause: unknown) => {
        if (id !== req.current) return;
        setFailed({ key, failure: readFailure(cause, projectId) });
      });
  }, [projectId, chosenBranch, key]);

  const { status, page, failure, branch, knownBranches, readAt } = deriveCommits({
    key,
    projectId,
    chosenBranch,
    loaded,
    failed,
  });

  function selectBranch(next: string) {
    if (!next || next === branch) return;
    setLoadMoreError(null);
    setChosenBranch(next);
  }

  function retry() {
    setLoadMoreError(null);
    setAttempt((value) => value + 1);
  }

  async function loadMore() {
    if (!page.next || loadingMore) return;
    const askedKey = key;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const response = await projectsRepository.commits(projectId, {
        branch,
        limit: COMMITS_PAGE_SIZE,
        before: page.next,
      });
      const more = normalizeCommitsPage(response);
      const readAt = Date.now();
      setLoaded((current) =>
        current?.key === askedKey ? { ...current, page: appendCommitsPage(current.page, more), readAt } : current,
      );
    } catch (cause) {
      setLoadMoreError(needsGithubSignIn(cause) ? readFailure(cause, projectId).message : LOAD_MORE_ERROR);
    } finally {
      setLoadingMore(false);
    }
  }

  return {
    status,
    error: failure ? failure.message : null,
    signInHref: failure ? failure.signInHref : null,
    branch,
    // The last branch list read, even while another branch loads, so the
    // selector does not collapse under the pointer that just used it.
    branchOptions: branchOptions(knownBranches, branch),
    rows: page.items,
    readAt,
    hasMore: page.next !== null,
    loadingMore,
    loadMoreError,
    selectBranch,
    loadMore,
    retry,
  };
}
