"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AppRole } from "@/shared/api/contracts";
import {
  getProjectPullRequestFiles,
  getProjectPullRequests,
  type PullRequestFile,
  type PullRequestSummary,
} from "@/features/projects";

import { canOpenPoStudio } from "../../model/project-detail-tab-rules";
import { CreatePullRequestView } from "./create-pull-request-view";
import { DiffView } from "./diff-view";
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceLoading,
} from "./workspace-states";
import {
  usePullRequestReviewViewModel,
  type PullRequestCheck,
  type PullRequestDetail,
  type MergeMethod,
  type PullRequestDetailResponse,
  type PullRequestReviewViewModel,
} from "../../view-models/use-pull-request-review-view-model";
import {
  explainMergeState,
  mergeButtonLabel,
  workspaceMergeGate,
} from "../../model/pull-request-merge-rules";

type StateFilter = "open" | "closed" | "all";

const FILTERS: ReadonlyArray<{ id: StateFilter; label: string }> = [
  { id: "open", label: "Open" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
];

/** Arriving on a pull request, the list starts on All: the one behind a commit is usually merged. */
function startFilter(focus: number | null | undefined): StateFilter {
  return focus == null ? "open" : "all";
}

function startFocus(focus: number | null | undefined): number | null {
  return focus ?? null;
}

/**
 * Pull requests for this project: what is in flight, what each one changes,
 * and opening a new one between any two branches.
 *
 * ALPHACI is where the team works, so proposing, reading and merging a change
 * all happen here. The pull requests are still GitHub's — branch protection
 * only counts reviews and merges GitHub knows about — which is why "Open on
 * GitHub" stays available as a secondary link rather than the way forward.
 */
export function PullRequestsTab({
  projectId,
  appRole,
  viewerLogin,
  onOpenPoStudio,
  initialFocusNumber,
}: {
  projectId: string;
  /** The viewer's app role, for the Phase 1 create/merge gates. */
  appRole?: AppRole;
  /** The viewer's GitHub login, for the compose presets' "own branch". */
  viewerLogin?: string | null;
  /** Opens the PO Studio tab, for the "merge into main" notice's link. */
  onOpenPoStudio?: () => void;
  /**
   * Arriving from a commit on the Code tab: open this pull request expanded.
   * The list starts on "All", since the pull request behind a commit is
   * usually merged already.
   */
  initialFocusNumber?: number | null;
}) {
  const [filter, setFilter] = useState<StateFilter>(() => startFilter(initialFocusNumber));
  const [composing, setComposing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Bumped to re-read the list when the filter did not change, e.g. after
  // opening a pull request while "Open" was already selected.
  const [reloadKey, setReloadKey] = useState(0);
  // The pull request to open expanded when the list next renders: the one
  // just created, so its merge controls are right there, or one the compose
  // screen pointed at because it already exists.
  const [focusNumber, setFocusNumber] = useState<number | null>(() => startFocus(initialFocusNumber));
  const [items, setItems] = useState<PullRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*
   * No synchronous setState — see the note in pipeline-runs-tab. `loading`
   * starts true for the first paint, and the filter buttons raise it
   * themselves because they are event handlers.
   */
  const load = useCallback(() => {
    return getProjectPullRequests(projectId, filter)
      .then((data) => {
        setItems(data.pullRequests);
        setError(null);
      })
      .catch(() =>
        setError("Pull requests could not be read from GitHub."),
      )
      .finally(() => setLoading(false));
  }, [projectId, filter]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const handleCreated = useCallback((pr: PullRequestSummary) => {
    setComposing(false);
    setNotice(`Pull request #${String(pr.number)} opened: ${pr.headRef} → ${pr.baseRef}.`);
    setFocusNumber(pr.number);
    setLoading(true);
    setFilter("open");
    setReloadKey((key) => key + 1);
  }, []);

  // A merge changes the row's state and usually empties it from "Open", so
  // the list is re-read rather than patched in place.
  const handleMerged = useCallback((pullNumber: number) => {
    setNotice(`Pull request #${String(pullNumber)} merged.`);
    setFocusNumber(null);
    setLoading(true);
    setReloadKey((key) => key + 1);
  }, []);

  const handleViewExisting = useCallback((pullNumber: number) => {
    setComposing(false);
    setNotice(null);
    setFocusNumber(pullNumber);
    setLoading(true);
    setFilter("open");
    setReloadKey((key) => key + 1);
  }, []);

  if (composing) {
    return (
      <div className="ws-panel">
        <CreatePullRequestView
          projectId={projectId}
          appRole={appRole}
          viewerLogin={viewerLogin}
          onCancel={() => setComposing(false)}
          onCreated={handleCreated}
          onViewExisting={handleViewExisting}
        />
      </div>
    );
  }

  return (
    <div className="ws-panel">
      {notice && (
        <p className="ws-compose__banner ws-compose__banner--ready" role="status">
          {notice}
        </p>
      )}
      <div className="ws-toolbar ws-toolbar--between">
        <div className="ws-filters" role="group" aria-label="Pull request state">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="ws-filter"
              aria-pressed={filter === option.id}
              onClick={() => {
                setLoading(true);
                setFocusNumber(null);
                setFilter(option.id);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="ws-toolbar__end">
          {appRole !== "qa" && (
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setNotice(null);
                setFocusNumber(null);
                setComposing(true);
              }}
            >
              New pull request
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <WorkspaceLoading rows={4} />
      ) : error ? (
        <WorkspaceError
          message={error}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      ) : items.length === 0 ? (
        <WorkspaceEmpty
          title="Nothing in flight"
          message={
            filter === "open"
              ? "There are no open pull requests on this repository."
              : "No pull requests match this filter."
          }
        />
      ) : (
        <ul className="ws-prs">
          {items.map((pr) => (
            <PullRequestRow
              key={pr.number}
              projectId={projectId}
              pr={pr}
              focused={pr.number === focusNumber}
              onMerged={handleMerged}
              appRole={appRole}
              onOpenPoStudio={onOpenPoStudio}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PullRequestRow({
  projectId,
  pr,
  focused = false,
  onMerged,
  appRole,
  onOpenPoStudio,
}: {
  projectId: string;
  pr: PullRequestSummary;
  onMerged: (pullNumber: number) => void;
  /** Open expanded and scrolled into view, e.g. arriving from compose. */
  focused?: boolean;
  appRole?: AppRole;
  onOpenPoStudio?: () => void;
}) {
  const [open, setOpen] = useState(focused);
  const [files, setFiles] = useState<PullRequestFile[] | null>(null);
  const [loading, setLoading] = useState(focused);
  const [error, setError] = useState<string | null>(null);
  const rowRef = useRef<HTMLLIElement>(null);

  // Resolves only; whoever starts a load raises `loading` first.
  const fetchFiles = useCallback(() => {
    return getProjectPullRequestFiles(projectId, pr.number)
      .then(setFiles)
      .catch(() => setError("The changed files could not be read."))
      .finally(() => setLoading(false));
  }, [projectId, pr.number]);

  // Files load on expand. A diff for every pull request in the list would be
  // dozens of requests for something nobody has asked to read yet.
  const loadFiles = useCallback(() => {
    setLoading(true);
    setError(null);
    void fetchFiles();
  }, [fetchFiles]);

  // A focused row starts expanded, so it loads without waiting for a click.
  // `loading` already started true for it, so nothing is set synchronously.
  useEffect(() => {
    if (!focused) return;
    rowRef.current?.scrollIntoView?.({ block: "nearest" });
    void fetchFiles();
  }, [focused, fetchFiles]);

  // Merged is a distinct state from closed, and conflating them loses the only
  // thing anyone wants to know about a finished pull request.
  const stateLabel = pr.merged ? "merged" : pr.state;

  return (
    <li className="ws-pr" ref={rowRef}>
      <button
        type="button"
        className="ws-pr__head"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && files === null && !loading) loadFiles();
        }}
      >
        <span className="ws-pr__caret" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
        <span className={`ws-pill ws-pill--${stateLabel}`}>
          {pr.draft ? "draft" : stateLabel}
        </span>
        <span className="ws-pr__title">
          <strong>#{pr.number}</strong> {pr.title}
        </span>
        <span className="ws-pr__meta">
          {pr.headRef} → {pr.baseRef}
          {pr.author ? ` · ${pr.author}` : ""}
        </span>
      </button>

      {open && (
        <div className="ws-pr__body">
          <PullRequestReview
            projectId={projectId}
            pr={pr}
            onMerged={onMerged}
            appRole={appRole}
            onOpenPoStudio={onOpenPoStudio}
          />
          <PullRequestFiles
            files={files}
            loading={loading}
            error={error}
            onRetry={loadFiles}
          />
        </div>
      )}
    </li>
  );
}

/** A pull request's changed files, or why they are not shown. */
function PullRequestFiles({
  files,
  loading,
  error,
  onRetry,
}: Readonly<{
  files: PullRequestFile[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}>) {
  if (loading) return <WorkspaceLoading rows={3} />;
  if (error) return <WorkspaceError message={error} onRetry={onRetry} />;
  if (files && files.length > 0) return <DiffView files={files} />;
  return (
    <WorkspaceEmpty
      title="No file changes"
      message="This pull request has no changed files to show."
    />
  );
}

/**
 * The decision surface for one pull request, inside the product.
 *
 * This replaced a link reading "Review and merge on GitHub", which was an
 * admission that the product tracked the pull request and then handed the
 * actual decision somewhere else. The two things the decision turns on are
 * here: what the checks say, and whether GitHub will allow the merge.
 *
 * GitHub is still linked, because a diff comment thread and a second
 * reviewer's approval live there. The difference is that it is no longer the
 * only way forward.
 */
function PullRequestReview({
  projectId,
  pr,
  onMerged,
  appRole,
  onOpenPoStudio,
}: Readonly<{
  projectId: string;
  pr: PullRequestSummary;
  onMerged: (pullNumber: number) => void;
  appRole?: AppRole;
  onOpenPoStudio?: () => void;
}>) {
  const review = usePullRequestReviewViewModel({
    projectId,
    pullNumber: pr.number,
    enabled: true,
    onMerged,
  });

  if (review.status === "loading") {
    return <p className="ws-hint">Reading the checks…</p>;
  }

  if (review.status === "error") {
    return (
      <WorkspaceError
        message={review.error ?? "This pull request could not be read."}
        onRetry={review.reload}
      />
    );
  }

  const detail = review.detail;
  if (!detail) return null;

  return (
    <div className="ws-prreview">
      <PullRequestChecks checks={detail.checks} />
      <MergeState detail={detail} />
      <div className="ws-prreview__actions">
        <MergeControl
          pr={detail.pullRequest}
          review={review}
          appRole={appRole}
          onOpenPoStudio={onOpenPoStudio}
        />
      </div>
      <MergeOutcome review={review} />
    </div>
  );
}

/** What GitHub's checks say, which is the first half of the decision. */
function PullRequestChecks({
  checks,
}: Readonly<{ checks: PullRequestCheck[] }>) {
  if (checks.length === 0) {
    return <p className="ws-hint">No checks have reported for this commit.</p>;
  }

  return (
    <ul className="ws-prchecks">
      {checks.map((check, index) => (
        <li key={`${check.name}-${String(index)}`} className="ws-prchecks__row">
          <span className={`ws-pill ws-pill--${checkTone(check)}`}>
            {check.conclusion ?? check.status}
          </span>
          <span className="ws-prchecks__name">{check.name}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Whether GitHub will allow the merge, said in words — see explainMergeState
 * for what each of GitHub's states means to the person deciding.
 */
function MergeState({
  detail,
}: Readonly<{ detail: PullRequestDetailResponse }>) {
  if (detail.pullRequest.merged) {
    return <p className="ws-hint">This pull request is merged.</p>;
  }

  const { tone, message } = explainMergeState(
    detail.pullRequest.draft ? "draft" : detail.pullRequest.mergeableState,
    detail.viewerIsAuthor,
  );

  return <p className={`ws-mergestate ws-mergestate--${tone}`}>{message}</p>;
}

const MERGE_METHODS: ReadonlyArray<{ id: MergeMethod; label: string }> = [
  { id: "merge", label: "Create a merge commit" },
  { id: "squash", label: "Squash and merge" },
  { id: "rebase", label: "Rebase and merge" },
];

/**
 * Whether, and what, to show in place of the merge action — the Phase 1
 * security gate (`workspaceMergeGate`, mirroring the backend's
 * `MAIN_MERGE_VIA_QA_STUDIO` and `PR_ROLE_FORBIDDEN` 403s).
 *
 * QA gets nothing here at all: it never merges through the workspace, and
 * saying so on every open pull request would be noise, not help. Every other
 * role merging into `main` gets the explanatory notice instead of a button
 * that would only 403 — with a link into QA Studio for the roles that can
 * actually open it.
 */
function MergeControl({
  pr,
  review,
  appRole,
  onOpenPoStudio,
}: Readonly<{
  pr: PullRequestDetail;
  review: PullRequestReviewViewModel;
  appRole?: AppRole;
  onOpenPoStudio?: () => void;
}>) {
  if (pr.merged || pr.state === "closed") return null;

  const gate = workspaceMergeGate(appRole, pr.baseRef, pr.headRef);
  if (gate.allowed) return <MergeButton pr={pr} review={review} />;
  if (gate.reason === "qa-role") return null;
  if (gate.reason === "route-restricted") {
    return (
      <p className="ws-hint" role="status">
        Developers merge feature → dev and dev → uat pull requests. Ask a Team
        lead to merge this one.
      </p>
    );
  }

  return (
    <p className="ws-hint" role="status">
      Merges into main go through PO Studio — Ready for production.
      {canOpenPoStudio(appRole) && onOpenPoStudio ? (
        <>
          {" "}
          <button type="button" className="ws-link" onClick={onOpenPoStudio}>
            Go to PO Studio
          </button>
        </>
      ) : null}
    </p>
  );
}

/**
 * The merge action: how to merge, and doing it.
 *
 * Disabled only when GitHub has already said no (`mergeable === false`) or
 * the pull request is a draft. Every other case is left to GitHub, whose
 * refusal is shown verbatim below — a repository that disallows squash says
 * so in its own words.
 */
function MergeButton({
  pr,
  review,
}: Readonly<{
  pr: PullRequestDetail;
  review: PullRequestReviewViewModel;
}>) {
  if (pr.merged || pr.state === "closed") return null;

  return (
    <div className="ws-mergeaction">
      <label className="ws-mergeaction__method">
        <span className="sr-only">Merge method</span>
        <select
          className="ws-select"
          value={review.mergeMethod}
          disabled={review.merging}
          onChange={(event) =>
            review.setMergeMethod(event.target.value as MergeMethod)
          }
        >
          {MERGE_METHODS.map((method) => (
            <option key={method.id} value={method.id}>
              {method.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="primary-button"
        disabled={review.merging || pr.mergeable === false || pr.draft}
        onClick={() => void review.merge()}
      >
        {review.merging ? "Merging…" : mergeButtonLabel(review.mergeMethod)}
      </button>
    </div>
  );
}

/**
 * GitHub's own sentence about the last attempt.
 *
 * A refusal is not an error here — "At least 1 approving review is required by
 * reviewers with write access" is the answer, and repeating it verbatim is the
 * whole reason for merging in the product rather than on GitHub.
 */
function MergeOutcome({
  review,
}: Readonly<{ review: PullRequestReviewViewModel }>) {
  if (!review.mergeMessage) return null;

  return (
    <p
      className={
        review.mergeFailed
          ? "ws-prreview__outcome ws-prreview__outcome--failed"
          : "ws-prreview__outcome"
      }
    >
      {review.mergeMessage}
    </p>
  );
}

/** A check's conclusion as one of the four workspace pill tones. */
function checkTone(
  check: PullRequestCheck,
): "success" | "failure" | "running" | "neutral" {
  if (check.status !== "completed") return "running";
  if (check.conclusion === "success") return "success";
  if (
    check.conclusion === "failure" ||
    check.conclusion === "timed_out" ||
    check.conclusion === "error"
  ) {
    return "failure";
  }
  return "neutral";
}
