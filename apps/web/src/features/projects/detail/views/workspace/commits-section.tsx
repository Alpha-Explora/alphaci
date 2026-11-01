"use client";

import "./commits-section.css";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";

import { auditAbsoluteTime, auditRelativeTime } from "../../model/audit-event-rules";
import type { BrowseCommit } from "../../model/code-commit-rules";
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
import { CheckIcon, CopyIcon } from "../clone-card";
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
  onBrowseCommit,
}: Readonly<{
  projectId: string;
  /** The branch to open on (a deep link); without one, the server's default. */
  initialBranch?: string | null;
  /** Opens the Pull requests tab on this pull request. Without it, titles are plain text. */
  onOpenPullRequest?: (pullRequestNumber: number) => void;
  /** Opens the Code tab at this commit. Without it, there is no "Browse files". */
  onBrowseCommit?: (commit: BrowseCommit) => void;
}>) {
  const vm = useProjectCommitsViewModel({ projectId, initialBranch });
  return <CommitsList vm={vm} onOpenPullRequest={onOpenPullRequest} onBrowseCommit={onBrowseCommit} />;
}

export function CommitsList({
  vm,
  onOpenPullRequest,
  onBrowseCommit,
}: Readonly<{
  vm: ProjectCommitsViewModel;
  onOpenPullRequest?: (pullRequestNumber: number) => void;
  onBrowseCommit?: (commit: BrowseCommit) => void;
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
      <CommitsBody vm={vm} onOpenPullRequest={onOpenPullRequest} onBrowseCommit={onBrowseCommit} />
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
  onBrowseCommit,
}: Readonly<{
  vm: ProjectCommitsViewModel;
  onOpenPullRequest?: (pullRequestNumber: number) => void;
  onBrowseCommit?: (commit: BrowseCommit) => void;
}>) {
  if (vm.status === "loading") return <CommitsSkeleton />;
  if (vm.status === "error") return <CommitsError vm={vm} />;
  if (vm.rows.length === 0) {
    return <WorkspaceEmpty title="No commits" message={commitsEmptyMessage(vm.branch)} />;
  }
  return (
    <>
      <ol className="commits__list" aria-label={vm.branch ? `Commits on ${vm.branch}` : "Commits"}>
        {groupCommitsByDay(vm.rows, vm.readAt).map((group) => (
          <li className="commits__day-group" key={group.key}>
            <h3 className="commits__day-label">{group.label}</h3>
            <ol className="commits__day-list">
              {group.rows.map((row) => (
                <CommitItem
                  key={row.sha}
                  row={row}
                  branch={vm.branch}
                  readAt={vm.readAt}
                  onOpenPullRequest={onOpenPullRequest}
                  onBrowseCommit={onBrowseCommit}
                />
              ))}
            </ol>
          </li>
        ))}
      </ol>
      <LoadMore vm={vm} />
    </>
  );
}

function groupCommitsByDay(rows: ReadonlyArray<CommitRow>, now: number) {
  const groups: Array<{ key: string; label: string; rows: CommitRow[] }> = [];
  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const todayKey = dayKey(today);
  const yesterdayKey = dayKey(yesterday);

  for (const row of rows) {
    const date = new Date(row.authoredAt);
    const valid = row.authoredAt !== "" && !Number.isNaN(date.getTime());
    const key = valid ? dayKey(date) : "unknown-date";
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const label = !valid
        ? "Date unavailable"
        : dayKey(date) === todayKey
          ? "Today"
          : dayKey(date) === yesterdayKey
            ? "Yesterday"
            : new Intl.DateTimeFormat(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              }).format(date);
      group = { key, label, rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
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
  onBrowseCommit,
}: Readonly<{
  row: CommitRow;
  branch: string | null;
  readAt: number;
  onOpenPullRequest?: (pullRequestNumber: number) => void;
  onBrowseCommit?: (commit: BrowseCommit) => void;
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
      <div className="commits__actions">
        <CopySha sha={row.sha} shortSha={row.shortSha} />
        {onBrowseCommit ? (
          <button
            type="button"
            className="commits__browse"
            aria-label={`Browse files at ${row.shortSha}`}
            title="Browse the repository at this commit"
            onClick={() => onBrowseCommit({ sha: row.sha, shortSha: row.shortSha, branch })}
          >
            <BrowseIcon />
          </button>
        ) : null}
      </div>
    </li>
  );
}

/** The "<>" code glyph GitHub uses for browsing a commit's files. */
function BrowseIcon() {
  return (
    <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" />
    </svg>
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

/**
 * The short SHA behind a copy icon, as GitHub shows it; a click copies the
 * full SHA and the icon turns to a check. Clipboard refusal is quiet: the SHA
 * is on screen.
 */
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
      <span className="commits__sha-icon">{copied ? <CheckIcon /> : <CopyIcon />}</span>
      <span className="commits__sha-text">{shaCopyLabel(shortSha, copied)}</span>
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
