"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  compareProjectBranches,
  createProjectPullRequest,
  getProjectBranches,
  type BranchComparisonResponse,
  type PullRequestSummary,
} from "../data/project-workspace-api";
import { apiErrorReason } from "../model/api-error-reason";
import {
  describeComparison,
  suggestTitle,
  type ComposeReadiness,
} from "../model/pull-request-compose-rules";

/*
 * Re-exported so the compose View can name what it renders without importing
 * from `data/` or `model/` — the ViewModel owns this contract.
 */
export type { BranchComparisonResponse, ComposeReadiness, PullRequestSummary };

/**
 * `choosing`: branches loaded, no head picked yet.
 * `comparing`: a comparison for the current pair is in flight.
 * `ready`: the comparison is on screen and the form can be submitted.
 * `submitting`: GitHub is being asked to open the pull request.
 * `error`: the branch list or the comparison could not be read; `retry` knows
 * which of the two to repeat.
 */
export type ComposeStatus =
  | "loading"
  | "choosing"
  | "comparing"
  | "ready"
  | "submitting"
  | "error";

export interface CreatePullRequestViewModel {
  status: ComposeStatus;
  error: string | null;
  branches: string[];
  base: string;
  head: string;
  compare: BranchComparisonResponse | null;
  readiness: ComposeReadiness | null;
  title: string;
  body: string;
  draft: boolean;
  /** GitHub's refusal, or a transport failure, from the last submit. */
  submitMessage: string | null;
  canSubmit: boolean;
  setBase: (branch: string) => void;
  setHead: (branch: string) => void;
  swapBranches: () => void;
  setTitle: (title: string) => void;
  setBody: (body: string) => void;
  setDraft: (draft: boolean) => void;
  submit: () => Promise<void>;
  retry: () => void;
}

/**
 * Compose a pull request between any two branches of a project.
 *
 * GitHub is read twice at most before anything is written: once for the
 * branch list when the screen opens, and once per branch pair chosen. Nothing
 * here polls — the comparison carries every diff, and the organisation shares
 * one rate limit.
 */
export function useCreatePullRequestViewModel(options: {
  projectId: string;
  onCreated: (pullRequest: PullRequestSummary) => void;
}): CreatePullRequestViewModel {
  const { projectId, onCreated } = options;

  const [status, setStatus] = useState<ComposeStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [base, setBaseState] = useState("");
  const [head, setHeadState] = useState("");
  const [compare, setCompare] = useState<BranchComparisonResponse | null>(
    null,
  );
  const [title, setTitleState] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  /*
   * Changing a branch while a comparison is in flight starts a second one. A
   * counter, not an `active` flag, decides which answer is kept: the slow
   * first request must not land on top of the fast second one.
   */
  const compareRequest = useRef(0);

  const loadBranches = useCallback(() => {
    return getProjectBranches(projectId)
      .then((result) => {
        setBranches(result.branches.map((branch) => branch.name));
        setBaseState(result.defaultBranch);
        setBranchesLoaded(true);
        setError(null);
        setStatus("choosing");
      })
      .catch((cause: unknown) => {
        setError(
          apiErrorReason(cause, "The branches could not be read from GitHub."),
        );
        setStatus("error");
      });
  }, [projectId]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  /** Handlers own the loading transition; this only resolves. */
  const runCompare = useCallback(
    (nextBase: string, nextHead: string) => {
      const request = ++compareRequest.current;
      setCompare(null);
      setSubmitMessage(null);

      if (!nextBase || !nextHead || nextBase === nextHead) {
        setStatus("choosing");
        return;
      }

      setStatus("comparing");
      compareProjectBranches(projectId, nextBase, nextHead)
        .then((result) => {
          if (request !== compareRequest.current) return;
          setCompare(result);
          setError(null);
          setStatus("ready");
          // A title the person typed is theirs; only an untouched one follows
          // the branch they picked.
          if (!titleEdited) {
            setTitleState(suggestTitle(nextHead, result.comparison.commits));
          }
        })
        .catch((cause: unknown) => {
          if (request !== compareRequest.current) return;
          setError(
            apiErrorReason(cause, "The branches could not be compared."),
          );
          setStatus("error");
        });
    },
    [projectId, titleEdited],
  );

  const setBase = useCallback(
    (branch: string) => {
      setBaseState(branch);
      runCompare(branch, head);
    },
    [head, runCompare],
  );

  const setHead = useCallback(
    (branch: string) => {
      setHeadState(branch);
      runCompare(base, branch);
    },
    [base, runCompare],
  );

  const swapBranches = useCallback(() => {
    setBaseState(head);
    setHeadState(base);
    runCompare(head, base);
  }, [base, head, runCompare]);

  const setTitle = useCallback((next: string) => {
    setTitleState(next);
    setTitleEdited(true);
  }, []);

  const retry = useCallback(() => {
    setStatus("loading");
    if (branchesLoaded) {
      runCompare(base, head);
    } else {
      void loadBranches();
    }
  }, [branchesLoaded, base, head, runCompare, loadBranches]);

  const readiness = useMemo(
    () => (compare ? describeComparison(compare) : null),
    [compare],
  );

  const canSubmit =
    status === "ready" &&
    readiness?.canCreate === true &&
    title.trim().length > 0;

  /**
   * Ask GitHub to open the pull request, and keep whatever it says.
   *
   * A refusal arrives as `created: false` with GitHub's sentence and leaves
   * the form as it was, so the person can act on it without retyping.
   */
  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setStatus("submitting");
    setSubmitMessage(null);
    try {
      const result = await createProjectPullRequest(projectId, {
        base,
        head,
        title: title.trim(),
        ...(body.trim() ? { body } : {}),
        draft,
      });
      if (result.created) {
        onCreated(result.pullRequest);
        return;
      }
      setSubmitMessage(result.message);
      setStatus("ready");
    } catch (cause: unknown) {
      setSubmitMessage(
        apiErrorReason(cause, "The pull request could not be opened."),
      );
      setStatus("ready");
    }
  }, [canSubmit, projectId, base, head, title, body, draft, onCreated]);

  return {
    status,
    error,
    branches,
    base,
    head,
    compare,
    readiness,
    title,
    body,
    draft,
    submitMessage,
    canSubmit,
    setBase,
    setHead,
    swapBranches,
    setTitle,
    setBody,
    setDraft,
    submit,
    retry,
  };
}
