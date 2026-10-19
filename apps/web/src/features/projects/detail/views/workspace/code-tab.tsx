"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { Avatar } from "@/features/groups/workspace";
import {
  createProjectBranch,
  getProjectBranches,
  getProjectFiles,
  type RepoBranch,
  type RepoContentEntry,
  type RepoContentListing,
} from "@/features/projects";
import { relativeTime } from "@/features/runs";

import { browseRefFor } from "../../model/browse-ref";
import {
  browseCommitBackLabel,
  browseCommitBranch,
  browseCommitRef,
  commitAuthorLabel,
  commitCountLabel,
  entryCommit,
  type BrowseCommit,
} from "../../model/code-commit-rules";
import {
  useFileCommitsViewModel,
  type FileCommitsViewModel,
  type RepoPathCommit,
} from "../../view-models/use-file-commits-view-model";
import { WorkspaceEmpty, WorkspaceError, WorkspaceLoading } from "./workspace-states";
import "./code-tab.css";

/**
 * Browse the repository's source at a branch, or at one commit when the
 * Commits tab's "Browse files" opened it (the toolbar then names the commit
 * and offers the way back to its branch).
 *
 * Read-only, deliberately. Writing files is something the provisioning flow
 * does on your behalf; an editor here would be a different product, and one
 * GitHub already does far better.
 *
 * The path and ref live in component state rather than the URL. A file you are
 * part-way through reading is a reading position, not a destination worth
 * sharing, and a file's address on GitHub is deliberately not offered: ALPHACI
 * is the only place people are sent to.
 */
export function CodeTab({
  projectId,
  commit: initialCommit = null,
}: Readonly<{ projectId: string; commit?: BrowseCommit | null }>) {
  const [branches, setBranches] = useState<RepoBranch[]>([]);
  const [canCreateBranch, setCanCreateBranch] = useState(false);
  // The commit being browsed. Its SHA is the first `chosenRef`, so the branch
  // list's default below never replaces it.
  const [commit, setCommit] = useState<BrowseCommit | null>(initialCommit);
  /*
   * TWO refs, deliberately.
   *
   * `chosenRef` is the branch a PERSON picked, and it is the only ref in the
   * fetch effect's dependencies. `resolvedRef` is whatever the server or the
   * branch list settled on, and feeds the picker's display value only.
   *
   * Collapsing them into one piece of state made the effect retrigger itself:
   * it depended on the ref, and its own response set the ref, so every cold
   * open fetched the same listing twice. Separating "what was asked for" from
   * "what came back" is what makes one open cost one request.
   */
  const [chosenRef, setChosenRef] = useState<string | null>(() => browseCommitRef(initialCommit));
  const [resolvedRef, setResolvedRef] = useState<string | null>(() => browseCommitRef(initialCommit));
  const [path, setPath] = useState("");
  const [listing, setListing] = useState<RepoContentListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Branches load once. The ref is only DEFAULTED from the response, never
  // forced: once someone picks a branch, a re-render must not yank them back.
  useEffect(() => {
    let cancelled = false;
    getProjectBranches(projectId)
      .then((data) => {
        if (cancelled) return;
        setBranches(data.branches);
        setCanCreateBranch(data.canCreateBranch);
        // Display only — this must not move `chosenRef`, or the fetch effect
        // fires a second time for a listing it already has.
        setResolvedRef((current) => current ?? data.defaultBranch);
        // The list is role-filtered and may not contain the default branch
        // (`main`). Only then is a ref asked for explicitly; otherwise the
        // server's own default stands and a cold open stays one request.
        const fallback = browseRefFor(
          data.branches.map((branch) => branch.name),
          data.defaultBranch,
        );
        if (fallback !== data.defaultBranch) {
          setResolvedRef(fallback);
          setChosenRef((current) => current ?? fallback);
        }
      })
      .catch(() => {
        // Non-fatal: the file listing below resolves its own ref server-side,
        // so a failed branch list costs the picker, not the tab.
        if (!cancelled) setBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  /*
   * The effect only STARTS the request; every setState happens in a promise
   * callback. Resetting loading/error synchronously in an effect body triggers
   * a cascading render (react-hooks/set-state-in-effect), so the spinner is
   * raised by the handlers that cause navigation instead — see openEntry and
   * the branch picker — and `loading` simply starts true for the first render.
   */
  const load = useCallback(() => {
    let cancelled = false;
    getProjectFiles(projectId, { path, ref: chosenRef })
      .then((data) => {
        if (cancelled) return;
        setListing(data);
        setError(null);
        // Adopt what the server resolved so the picker stops reading as "no
        // branch". Safe because `resolvedRef` is not a dependency of this
        // effect.
        setResolvedRef(data.ref);
      })
      .catch(() => {
        if (!cancelled) setError("This path could not be read from GitHub.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, path, chosenRef]);

  useEffect(load, [load]);

  // What last changed this folder (or file) and each entry in it. Asked for
  // only once the listing for the current path is on screen.
  const commits = useFileCommitsViewModel({
    projectId,
    path,
    ref: !loading && !error && listing ? listing.ref : null,
  });

  // Breadcrumb segments, each carrying the path that leads back to it.
  const crumbs = useMemo(() => {
    if (!path) return [];
    const parts = path.split("/").filter(Boolean);
    return parts.map((label, index) => ({
      label,
      path: parts.slice(0, index + 1).join("/"),
    }));
  }, [path]);

  /** Raises the spinner here rather than in the effect — see `load`. */
  function goTo(nextPath: string) {
    setLoading(true);
    setPath(nextPath);
  }

  function openEntry(entry: RepoContentEntry) {
    // Only directories and files are navigable. A symlink or submodule points
    // somewhere this browser cannot follow, so it renders as a dead row rather
    // than a link that would 404.
    if (entry.type === "dir" || entry.type === "file") goTo(entry.path);
  }

  const file = listing?.file ?? null;

  /** Opens a branch at its top level: a picked one, or the browsed commit's own. */
  function showBranch(nextRef: string | null) {
    setLoading(true);
    setCommit(null);
    setChosenRef(nextRef);
    setResolvedRef(nextRef);
    setPath("");
  }

  return (
    <div className="ws-panel">
      <CodeToolbar
        branches={branches}
        chosenRef={chosenRef}
        resolvedRef={resolvedRef}
        commit={commit}
        crumbs={crumbs}
        canCreateBranch={canCreateBranch}
        onPickBranch={showBranch}
        onCreateBranch={async (branchName) => {
          await createProjectBranch(projectId, branchName);
          const updated = await getProjectBranches(projectId);
          setBranches(updated.branches);
          showBranch(branchName);
        }}
        onLeaveCommit={() => showBranch(browseCommitBranch(commit))}
        onGoTo={goTo}
      />
      <CodeBrowserBody
        loading={loading}
        error={error}
        file={file}
        listing={listing}
        path={path}
        commits={commits}
        onRetry={load}
        onOpen={openEntry}
        onGoTo={goTo}
      />
    </div>
  );
}

function CodeToolbar({
  branches,
  chosenRef,
  resolvedRef,
  commit,
  crumbs,
  canCreateBranch,
  onPickBranch,
  onCreateBranch,
  onLeaveCommit,
  onGoTo,
}: Readonly<{
  branches: RepoBranch[];
  chosenRef: string | null;
  resolvedRef: string | null;
  commit: BrowseCommit | null;
  crumbs: Array<{ label: string; path: string }>;
  canCreateBranch: boolean;
  onPickBranch: (nextRef: string) => void;
  onCreateBranch: (branchName: string) => Promise<void>;
  onLeaveCommit: () => void;
  onGoTo: (nextPath: string) => void;
}>) {
  return (
    <div className="ws-toolbar">
      {branches.length > 0 ? (
        <label className="ws-branch">
          <span className="ws-branch__label">Branch</span>
          <select
            className="ws-select"
            value={chosenRef ?? resolvedRef ?? ""}
            onChange={(event) => onPickBranch(event.target.value)}
          >
            {commit ? (
              <option value={commit.sha} disabled>
                {commit.shortSha}
              </option>
            ) : null}
            {branches.map((branch) => (
              <option key={branch.name} value={branch.name}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {canCreateBranch && branches.some((branch) => branch.name === "dev") ? (
        <BranchCreateControl onCreateBranch={onCreateBranch} />
      ) : null}
      {commit ? <CommitMarker commit={commit} onLeave={onLeaveCommit} /> : null}

      {/* At the top level there is no path to show; inside a folder, the
          first crumb is an icon back to the top instead of the word "root". */}
      {crumbs.length > 0 ? (
      <nav className="ws-crumbs" aria-label="File path">
        <button
          type="button"
          className="ws-crumb ws-crumb--home"
          aria-label="Repository root"
          title="Repository root"
          onClick={() => onGoTo("")}
        >
          <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 16" width="14">
            <path
              d="M1.75 4.25c0-.69.56-1.25 1.25-1.25h3.1l1.5 1.5H13c.69 0 1.25.56 1.25 1.25v6.5c0 .69-.56 1.25-1.25 1.25H3c-.69 0-1.25-.56-1.25-1.25v-8Z"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1.4"
            />
          </svg>
        </button>
        {crumbs.map((crumb) => (
          <span key={crumb.path}>
            <span className="ws-crumb-sep" aria-hidden="true">
              /
            </span>
            <button
              type="button"
              className="ws-crumb"
              onClick={() => onGoTo(crumb.path)}
            >
              {crumb.label}
            </button>
          </span>
        ))}
      </nav>
      ) : null}
    </div>
  );
}

function BranchCreateControl({
  onCreateBranch,
}: Readonly<{ onCreateBranch: (branchName: string) => Promise<void> }>) {
  const [creating, setCreating] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = branchName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      await onCreateBranch(name);
      setCreating(false);
      setBranchName("");
    } catch {
      setError("Branch could not be created. Check the name and your GitHub access.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ws-branch-create-wrap">
      <button
        type="button"
        className="ws-branch-create__toggle"
        aria-expanded={creating}
        onClick={() => {
          setCreating((open) => !open);
          setError(null);
        }}
      >
        {creating ? "Cancel" : "Create branch"}
      </button>
      {creating ? (
        <form className="ws-branch-create" onSubmit={submit}>
          <label className="ws-branch-create__field">
            <span>Branch name</span>
            <input
              autoFocus
              maxLength={255}
              value={branchName}
              onChange={(event) => setBranchName(event.target.value)}
              placeholder="feature/your-change"
              required
            />
          </label>
          <span className="ws-branch-create__source">Based on dev</span>
          <button type="submit" disabled={saving || !branchName.trim()}>
            {saving ? "Creating…" : "Create"}
          </button>
          {error ? <span className="ws-branch-create__error" role="alert">{error}</span> : null}
        </form>
      ) : null}
    </div>
  );
}

/** Names the commit being browsed, read-only, and the way back to its branch. */
function CommitMarker({ commit, onLeave }: Readonly<{ commit: BrowseCommit; onLeave: () => void }>) {
  return (
    <p className="code-commit" role="status">
      <span className="code-commit__label">
        Browsing commit <code className="code-commit__sha" title={commit.sha}>{commit.shortSha}</code>
      </span>
      <button type="button" className="code-commit__back" onClick={onLeave}>
        {browseCommitBackLabel(commit.branch)}
      </button>
    </p>
  );
}

function CodeEntries({
  listing,
  path,
  commits,
  onOpen,
  onGoTo,
}: Readonly<{
  listing: RepoContentListing;
  path: string;
  commits: FileCommitsViewModel;
  onOpen: (entry: RepoContentEntry) => void;
  onGoTo: (nextPath: string) => void;
}>) {
  return (
    <ul className="ws-tree code-tree">
      {path ? (
        <li>
          <button
            type="button"
            className="ws-tree__row code-tree__row"
            onClick={() => onGoTo(path.split("/").slice(0, -1).join("/"))}
          >
            <span className="ws-tree__icon" aria-hidden="true">
              ↰
            </span>
            <span className="ws-tree__name">..</span>
          </button>
        </li>
      ) : null}
      {listing.entries.map((entry) => (
        <CodeEntryRow
          key={entry.sha || entry.path}
          entry={entry}
          commit={entryCommit(commits.commits, entry.path)}
          onOpen={onOpen}
        />
      ))}
    </ul>
  );
}

function CodeEntryRow({
  entry,
  commit,
  onOpen,
}: Readonly<{
  entry: RepoContentEntry;
  commit: RepoPathCommit | null;
  onOpen: (entry: RepoContentEntry) => void;
}>) {
  return (
    <li>
      <button
        type="button"
        className="ws-tree__row code-tree__row"
        onClick={() => onOpen(entry)}
      >
        <span className="ws-tree__icon" aria-hidden="true">
          {entry.type === "dir" ? <FolderIcon /> : <FileIcon />}
        </span>
        <span className="ws-tree__name">{entry.name}</span>
        <span className="code-tree__message" title={commit?.message}>
          {commit?.message ?? ""}
        </span>
        <CommitTime commit={commit} className="code-tree__time" />
      </button>
    </li>
  );
}

/** "3d ago", with the exact date on hover. Empty until the commit is known. */
function CommitTime({
  commit,
  className,
}: Readonly<{ commit: RepoPathCommit | null; className: string }>) {
  if (!commit) return <span className={className} />;
  return (
    <time
      className={className}
      dateTime={commit.committedAt}
      title={new Date(commit.committedAt).toLocaleString()}
    >
      {relativeTime(commit.committedAt)}
    </time>
  );
}

/**
 * The bar above the list: who last changed this folder (or file), with what
 * message, which commit and when, and how many commits touched it. Nothing
 * at all when GitHub could not say: the files are what this tab is for.
 */
function LatestCommitBar({ commits }: Readonly<{ commits: FileCommitsViewModel }>) {
  if (commits.status === "loading") {
    return (
      <div className="code-commit-bar code-commit-bar--loading" aria-busy="true">
        Loading the latest commit…
      </div>
    );
  }
  const latest = commits.commits?.latest;
  if (commits.status !== "ready" || !latest) return null;
  const total = commits.commits?.totalCommits ?? null;
  return (
    <div className="code-commit-bar">
      <Avatar
        login={latest.authorLogin}
        name={latest.authorName}
        avatarUrl={latest.authorAvatarUrl}
      />
      <strong className="code-commit-bar__author">{commitAuthorLabel(latest)}</strong>
      <span className="code-commit-bar__message" title={latest.message}>
        {latest.message}
      </span>
      <span className="code-commit-bar__meta">
        <code>{latest.shortSha}</code>
        <span aria-hidden="true">·</span>
        <CommitTime commit={latest} className="code-commit-bar__time" />
      </span>
      {total !== null ? (
        <span className="code-commit-bar__count">
          <HistoryIcon />
          {commitCountLabel(total)}
        </span>
      ) : null}
    </div>
  );
}

function CodeBrowserBody({
  loading,
  error,
  file,
  listing,
  path,
  commits,
  onRetry,
  onOpen,
  onGoTo,
}: Readonly<{
  loading: boolean;
  error: string | null;
  file: NonNullable<RepoContentListing["file"]> | null;
  listing: RepoContentListing | null;
  path: string;
  commits: FileCommitsViewModel;
  onRetry: () => void;
  onOpen: (entry: RepoContentEntry) => void;
  onGoTo: (nextPath: string) => void;
}>) {
  if (loading) return <WorkspaceLoading rows={6} />;
  if (error) return <WorkspaceError message={error} onRetry={onRetry} />;
  if (file) {
    return (
      <div className="code-browser">
        <LatestCommitBar commits={commits} />
        <FileView file={file} />
      </div>
    );
  }
  if (listing && listing.entries.length > 0) {
    return (
      <div className="code-browser">
        <LatestCommitBar commits={commits} />
        <CodeEntries
          listing={listing}
          path={path}
          commits={commits}
          onOpen={onOpen}
          onGoTo={onGoTo}
        />
      </div>
    );
  }
  return (
    <WorkspaceEmpty
      title="Nothing here"
      message="This branch has no files at this path yet."
    />
  );
}

function FileView({ file }: { file: NonNullable<RepoContentListing["file"]> }) {
  return (
    <div className="ws-file">
      <div className="ws-file__head">
        <strong>{file.name}</strong>
        <span className="ws-file__meta">{formatBytes(file.size)}</span>
      </div>
      {file.content === null ? (
        <WorkspaceEmpty
          title="Not shown"
          message={
            file.truncated
              ? "This file is binary or too large to preview here."
              : "This file has no readable text content."
          }
        />
      ) : (
        <pre className="ws-code">
          <code>{file.content}</code>
        </pre>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* Line icons, 16px, currentColor, decorative. */

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M3 6a2 2 0 0 1 2-2h4.2a2 2 0 0 1 1.4.6L12 6h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="14 3 14 9 20 9" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <polyline points="3 3 3 8 8 8" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}
