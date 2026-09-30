"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  compareProjectBranches,
  createProjectPullRequest,
  getProjectBranches,
  type BranchComparisonResponse,
  type PullRequestSummary,
} from "../data/project-workspace-api";
import type { AppRole } from "@/shared/api/contracts";
import { apiErrorReason } from "../model/api-error-reason";
import { workspacePermissionErrorMessage } from "../model/workspace-permission-errors";
import {
  applyPreset,
  canCreatePullRequest,
  defaultComposeBase,
  defaultPresetId,
  describeComparison,
  isPullRequestRole,
  presetFor,
  PULL_REQUEST_PRESET_IDS,
  suggestTitle,
  type ComposeReadiness,
  type PullRequestPreset,
  type PullRequestPresetId,
} from "../model/pull-request-compose-rules";

/*
 * Re-exported so the compose View can name what it renders without importing
 * from `data/` or `model/` — the ViewModel owns this contract.
 */
export type {
  BranchComparisonResponse,
  ComposeReadiness,
  PullRequestPreset,
  PullRequestPresetId,
  PullRequestSummary,
};

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
  /** Selected preset; `custom` leaves both pickers free. */
  preset: PullRequestPresetId;
  /** Presets to offer, or empty when the viewer's role has none. */
  presets: PullRequestPreset[];
  compare: BranchComparisonResponse | null;
  readiness: ComposeReadiness | null;
  title: string;
  body: string;
  draft: boolean;
  /** GitHub's refusal, or a transport failure, from the last submit. */
  submitMessage: string | null;
  canSubmit: boolean;
  selectPreset: (id: PullRequestPresetId) => void;
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
  /** The viewer's app role, for the Phase 1 create-PR gate. */
  appRole?: AppRole;
  /** The viewer's GitHub login, to recognise their own branches. */
  viewerLogin?: string | null;
  onCreated: (pullRequest: PullRequestSummary) => void;
}): CreatePullRequestViewModel {
  const { projectId, appRole, viewerLogin, onCreated } = options;

  const [status, setStatus] = useState<ComposeStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [base, setBaseState] = useState("");
  const [head, setHeadState] = useState("");
  const [preset, setPreset] = useState<PullRequestPresetId>("custom");
  const [compare, setCompare] = useState<BranchComparisonResponse | null>(
    null,
  );
  const [title, setTitleState] = useState("");
  // A ref, not state: reading it must not change `runCompare`'s identity, or
  // the branch list would be re-fetched every time the title is first typed.
  const titleEdited = useRef(false);
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  /*
   * Changing a branch while a comparison is in flight starts a second one. A
   * counter, not an `active` flag, decides which answer is kept: the slow
   * first request must not land on top of the fast second one.
   */
  const compareRequest = useRef(0);

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
          if (!titleEdited.current) {
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
    [projectId],
  );

  const loadBranches = useCallback(() => {
    return getProjectBranches(projectId)
      .then((result) => {
        const names = result.branches.map((branch) => branch.name);
        setBranches(names);
        setBranchesLoaded(true);
        setError(null);
        // Not `result.defaultBranch`: on this product that is `main`, the one
        // branch this composer must never default into (see
        // `defaultComposeBase`). The default preset picks the base; without
        // one that applies, `defaultComposeBase` does. Nothing here assumes
        // `main`, or any given branch, is in the (role-filtered) list.
        const context = { branches: names, role: appRole, login: viewerLogin };
        const initial = defaultPresetId(context);
        const applied = applyPreset(initial, context);
        setPreset(initial);
        setBaseState(applied?.base ?? defaultComposeBase(names));
        setHeadState(applied?.head ?? "");
        if (applied?.head) {
          runCompare(applied.base, applied.head);
        } else {
          setStatus("choosing");
        }
      })
      .catch((cause: unknown) => {
        setError(
          apiErrorReason(cause, "The branches could not be read from GitHub."),
        );
        setStatus("error");
      });
  }, [projectId, appRole, viewerLogin, runCompare]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  const setBase = useCallback(
    (branch: string) => {
      setBaseState(branch);
      runCompare(branch, head);
    },
    [head, runCompare],
  );

  const context = useMemo(
    () => ({ branches, role: appRole, login: viewerLogin }),
    [branches, appRole, viewerLogin],
  );

  const presets = useMemo(
    () =>
      isPullRequestRole(appRole)
        ? PULL_REQUEST_PRESET_IDS.map((id) => presetFor(id, context))
        : [],
    [appRole, context],
  );

  /**
   * Choose a preset. An unavailable one is ignored (the View disables it, but
   * this does not trust that alone). `custom` keeps whatever is picked now.
   */
  const selectPreset = useCallback(
    (id: PullRequestPresetId) => {
      if (!presetFor(id, context).available) return;
      setPreset(id);
      const applied = applyPreset(id, context);
      if (!applied) return;
      setBaseState(applied.base);
      setHeadState(applied.head);
      runCompare(applied.base, applied.head);
    },
    [context, runCompare],
  );

  const setHead = useCallback(
    (branch: string) => {
      setHeadState(branch);
      runCompare(base, branch);
    },
    [base, runCompare],
  );

  const swapBranches = useCallback(() => {
    // A swap is a free choice of branches, whatever preset was on.
    setPreset("custom");
    setBaseState(head);
    setHeadState(base);
    runCompare(head, base);
  }, [base, head, runCompare]);

  const setTitle = useCallback((next: string) => {
    setTitleState(next);
    titleEdited.current = true;
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
    title.trim().length > 0 &&
    canCreatePullRequest(appRole, base);

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
        workspacePermissionErrorMessage(
          cause,
          "The pull request could not be opened.",
        ),
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
    preset,
    presets,
    compare,
    readiness,
    title,
    body,
    draft,
    submitMessage,
    canSubmit,
    selectPreset,
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
