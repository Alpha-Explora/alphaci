"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getProjectPullRequestFiles,
  getProjectPullRequests,
  type PullRequestFile,
  type PullRequestSummary,
} from "@/features/projects";

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
  type PullRequestDetailResponse,
  type PullRequestReviewViewModel,
} from "../../view-models/use-pull-request-review-view-model";

type StateFilter = "open" | "closed" | "all";

const FILTERS: ReadonlyArray<{ id: StateFilter; label: string }> = [
  { id: "open", label: "Open" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
];

/**
 * Pull requests for this project: what is in flight, what each one changes,
 * and opening a new one between any two branches.
 *
 * ALPHACI is where the team works, so proposing, reading and merging a change
 * all happen here. The pull requests are still GitHub's — branch protection
 * only counts reviews and merges GitHub knows about — which is why "Open on
 * GitHub" stays available as a secondary link rather than the way forward.
 */
export function PullRequestsTab({ projectId }: { projectId: string }) {
  const [filter, setFilter] = useState<StateFilter>("open");
  const [composing, setComposing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Bumped to re-read the list when the filter did not change, e.g. after
  // opening a pull request while "Open" was already selected.
  const [reloadKey, setReloadKey] = useState(0);
  // The pull request to open expanded when the list next renders — set when
  // the compose screen points at one that already exists.
  const [focusNumber, setFocusNumber] = useState<number | null>(null);
  const [items, setItems] = useState<PullRequestSummary[]>([]);
  const [pullsUrl, setPullsUrl] = useState<string | null>(null);
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
        setPullsUrl(data.pullsUrl);
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
    setLoading(true);
    setFilter("open");
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
          {pullsUrl && (
            <a
              className="ws-link"
              href={pullsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open on GitHub ↗
            </a>
          )}
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
}: {
  projectId: string;
  pr: PullRequestSummary;
  /** Open expanded and scrolled into view, e.g. arriving from compose. */
  focused?: boolean;
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
          <PullRequestReview projectId={projectId} pr={pr} />
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
}: Readonly<{ projectId: string; pr: PullRequestSummary }>) {
  const review = usePullRequestReviewViewModel({
    projectId,
    pullNumber: pr.number,
    enabled: true,
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
        <MergeButton pr={detail.pullRequest} review={review} />
        <a
          className="ws-link"
          href={pr.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open on GitHub ↗
        </a>
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
          {check.detailsUrl && (
            <a
              className="ws-link"
              href={check.detailsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              details ↗
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Whether GitHub will allow the merge, said in words.
 *
 * `blocked` is the interesting one and the reason this is worth rendering: it
 * means the checks may be green while a protection rule still stands in the
 * way, which is exactly the state that makes a bare "merge failed" baffling.
 */
function MergeState({
  detail,
}: Readonly<{ detail: PullRequestDetailResponse }>) {
  const { mergeableState, merged } = {
    mergeableState: detail.pullRequest.mergeableState,
    merged: detail.pullRequest.merged,
  };

  if (merged) return <p className="ws-hint">This pull request is merged.</p>;

  const explanation =
    mergeableState === "blocked"
      ? "GitHub is holding this back: a branch protection rule on the base branch is not satisfied yet, usually a required review."
      : mergeableState === "dirty"
        ? "The branch conflicts with its base and has to be updated before it can merge."
        : mergeableState === "unknown"
          ? "GitHub has not finished working out whether this can merge. Reload in a moment."
          : mergeableState === "clean"
            ? "GitHub will accept this merge."
            : `GitHub reports this as '${mergeableState}'.`;

  return (
    <p className="ws-hint">
      {explanation}
      {detail.viewerIsAuthor && (
        <>
          {" "}
          You opened this pull request, and GitHub does not allow approving your
          own — a second reviewer, or an admin merge, is needed.
        </>
      )}
    </p>
  );
}

function MergeButton({
  pr,
  review,
}: Readonly<{
  pr: PullRequestDetail;
  review: PullRequestReviewViewModel;
}>) {
  if (pr.merged || pr.state === "closed") return null;

  return (
    <button
      type="button"
      className="primary-button"
      disabled={review.merging || pr.mergeable === false}
      onClick={() => void review.merge()}
    >
      {review.merging ? "Merging…" : "Merge"}
    </button>
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
