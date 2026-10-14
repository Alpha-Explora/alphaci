"use client";

import "./commits-section.css";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";

import { auditAbsoluteTime, auditRelativeTime } from "../../model/audit-event-rules";
import {
  commitPullRequestLabel,
  commitsEmptyMessage,
  commitsLoadMoreLabel,
  ALPHACI_SETUP_LABEL,
  shaCopyLabel,
  type CommitRow,
} from "../../model/commit-list-rules";
import {
  useProjectCommitsViewModel,
  type ProjectCommitsViewModel,
} from "../../view-models/use-project-commits-view-model";
import { WorkspaceEmpty, WorkspaceError } from "./workspace-states";

/**
 * The Commits tab: the repository's commits on one branch, newest first, the
 * branch chosen with the one selector at the top. Every commit says where it
 * came from: the pull request that brought it in (opened in the Pull requests
 * tab here), an "ALPHACI setup" label for what ALPHACI's own GitHub App wrote,
 * or — on dev, uat and main, when a person pushed it — a "Direct push" tag:
 * it skipped review, which is the thing this list exists to make visible.
 */
export function CommitsSection({
  projectId,
  initialBranch,
  onOpenPullRequest,
}: Readonly<{
  projectId: string;
  /** The branch to open on (a deep link); without one, the server's default. */
  initialBranch?: string | null;
  /** Opens the Pull requests tab on this pull request. Without it, titles are plain text. */
  onOpenPullRequest?: (pullRequestNumber: number) => void;
}>) {
  const vm = useProjectCommitsViewModel({ projectId, initialBranch });
  return <CommitsList vm={vm} onOpenPullRequest={onOpenPullRequest} />;
}

export function CommitsList({
  vm,
  onOpenPullRequest,
}: Readonly<{
  vm: ProjectCommitsViewModel;
  onOpenPullRequest?: (pullRequestNumber: number) => void;
}>) {
  const titleId = useId();
  return (
    <section className="commits" aria-labelledby={titleId}>
      <div className="commits__head">
        <h2 className="commits__title" id={titleId}>
          Commits
        </h2>
        <BranchSelect vm={vm} />
      </div>
      <CommitsBody vm={vm} onOpenPullRequest={onOpenPullRequest} />
    </section>
  );
}

/** The one branch selector: dev, uat, main as the repository has them. */
function BranchSelect({ vm }: Readonly<{ vm: ProjectCommitsViewModel }>) {
  const selectId = useId();
  if (vm.branchOptions.length === 0) return null;
  return (
    <div className="commits__switch">
      <label className="commits__label" htmlFor={selectId}>
        Branch
      </label>
      <select
        id={selectId}
        className="ws-select commits__select"
        value={vm.branch ?? ""}
        onChange={(event) => vm.selectBranch(event.target.value)}
      >
        {vm.branch === null ? (
          <option value="" disabled>
            Choose a branch
          </option>
        ) : null}
        {vm.branchOptions.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}

function CommitsBody({
  vm,
  onOpenPullRequest,
}: Readonly<{
  vm: ProjectCommitsViewModel;
  onOpenPullRequest?: (pullRequestNumber: number) => void;
}>) {
  if (vm.status === "loading") return <CommitsSkeleton />;
  if (vm.status === "error") return <CommitsError vm={vm} />;
  if (vm.rows.length === 0) {
    return <WorkspaceEmpty title="No commits" message={commitsEmptyMessage(vm.branch)} />;
  }
  return (
    <>
      <ol className="commits__list" aria-label={vm.branch ? `Commits on ${vm.branch}` : "Commits"}>
        {vm.rows.map((row) => (
          <CommitItem
            key={row.sha}
            row={row}
            branch={vm.branch}
            readAt={vm.readAt}
            onOpenPullRequest={onOpenPullRequest}
          />
        ))}
      </ol>
      <LoadMore vm={vm} />
    </>
  );
}

function CommitsSkeleton() {
  return (
    <ul className="commits__list" aria-busy="true" aria-label="Loading commits">
      {[0, 1, 2, 3].map((key) => (
        <li key={key} className="commits__row commits__row--skeleton" aria-hidden="true" />
      ))}
    </ul>
  );
}

/** A stale GitHub session gets a way forward; anything else, a retry. */
function CommitsError({ vm }: Readonly<{ vm: ProjectCommitsViewModel }>) {
  if (!vm.signInHref) return <WorkspaceError message={vm.error ?? ""} onRetry={vm.retry} />;
  return (
    <div className="ws-error commits__reauth" role="alert">
      <p>{vm.error}</p>
      <a className="ghost-button" href={vm.signInHref}>
        Sign in again
      </a>
    </div>
  );
}

function CommitItem({
  row,
  branch,
  readAt,
  onOpenPullRequest,
}: Readonly<{
  row: CommitRow;
  branch: string | null;
  readAt: number;
  onOpenPullRequest?: (pullRequestNumber: number) => void;
}>) {
  return (
    <li
      className="commits__row"
      data-source={row.pullRequestNumber !== null ? "pull-request" : "push"}
      data-direct-push={row.directPush ? "true" : undefined}
    >
      <span className="commits__node" aria-hidden="true" />
      <div className="commits__body">
        <p className="commits__message">
          <CommitTitle row={row} onOpenPullRequest={onOpenPullRequest} />
          {row.directPush ? (
            <span
              className="commits__tag"
              title={`Pushed straight to ${branch ?? "this branch"}, without a pull request`}
            >
              Direct push
            </span>
          ) : null}
          {row.alphaciSetup ? (
            <span className="commits__tag commits__tag--setup" title="Written by ALPHACI's GitHub App">
              {ALPHACI_SETUP_LABEL}
            </span>
          ) : null}
        </p>
        <p className="commits__meta">
          <span className="commits__author">{row.author}</span>
          {row.authoredAt ? (
            <time dateTime={row.authoredAt} title={auditAbsoluteTime(row.authoredAt)}>
              {auditRelativeTime(row.authoredAt, readAt)}
            </time>
          ) : null}
        </p>
      </div>
      <CopySha sha={row.sha} shortSha={row.shortSha} />
    </li>
  );
}

function CommitTitle({
  row,
  onOpenPullRequest,
}: Readonly<{ row: CommitRow; onOpenPullRequest?: (pullRequestNumber: number) => void }>) {
  const number = row.pullRequestNumber;
  const openPullRequest = onOpenPullRequest;
  if (number === null || !openPullRequest) {
    return <span className="commits__text">{row.title}</span>;
  }
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    openPullRequest(number);
  };
  return (
    <>
      <a className="commits__text commits__text--link" href="#pulls" title={commitPullRequestLabel(number)} onClick={open}>
        {row.title}
      </a>
      <span className="commits__pr">#{number}</span>
    </>
  );
}

/** The short SHA; a click copies the full one. Clipboard refusal is quiet: the SHA is on screen. */
function CopySha({ sha, shortSha }: Readonly<{ sha: string; shortSha: string }>) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(sha);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1_600);
    } catch {
      // Refused or unavailable: nothing to escalate.
    }
  }

  return (
    <button
      type="button"
      className="commits__sha"
      data-copied={copied ? "true" : undefined}
      aria-label={copied ? "Commit SHA copied" : `Copy commit SHA ${shortSha}`}
      title={sha}
      onClick={() => void copy()}
    >
      {shaCopyLabel(shortSha, copied)}
    </button>
  );
}

function LoadMore({ vm }: Readonly<{ vm: ProjectCommitsViewModel }>) {
  if (!vm.hasMore && !vm.loadMoreError) return null;
  return (
    <div className="commits__more">
      {vm.hasMore ? (
        <button
          type="button"
          className="ghost-button commits__more-button"
          disabled={vm.loadingMore}
          onClick={() => void vm.loadMore()}
        >
          {commitsLoadMoreLabel(vm.loadingMore)}
        </button>
      ) : null}
      {vm.loadMoreError ? (
        <p className="error-text" role="alert" style={{ margin: 0 }}>
          {vm.loadMoreError}
        </p>
      ) : null}
    </div>
  );
}
