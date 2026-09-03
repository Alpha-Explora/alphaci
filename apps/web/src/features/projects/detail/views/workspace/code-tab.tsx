"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getProjectBranches,
  getProjectFiles,
  type RepoBranch,
  type RepoContentEntry,
  type RepoContentListing,
} from "@/features/projects";

import { WorkspaceEmpty, WorkspaceError, WorkspaceLoading } from "./workspace-states";

/**
 * Browse the repository's source at a branch.
 *
 * Read-only, deliberately. Writing files is something the provisioning flow
 * does on your behalf; an editor here would be a different product, and one
 * GitHub already does far better.
 *
 * The path and ref live in component state rather than the URL. A file you are
 * part-way through reading is a reading position, not a destination worth
 * sharing — and every file already carries an "Open on GitHub" link, which is
 * the shareable address people actually expect.
 */
export function CodeTab({ projectId }: { projectId: string }) {
  const [branches, setBranches] = useState<RepoBranch[]>([]);
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
  const [chosenRef, setChosenRef] = useState<string | null>(null);
  const [resolvedRef, setResolvedRef] = useState<string | null>(null);
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
        // Display only — this must not move `chosenRef`, or the fetch effect
        // fires a second time for a listing it already has.
        setResolvedRef((current) => current ?? data.defaultBranch);
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

  return (
    <div className="ws-panel">
      <CodeToolbar
        branches={branches}
        chosenRef={chosenRef}
        resolvedRef={resolvedRef}
        crumbs={crumbs}
        onPickBranch={(nextRef) => {
          setLoading(true);
          setChosenRef(nextRef);
          setResolvedRef(nextRef);
          setPath("");
        }}
        onGoTo={goTo}
      />
      <CodeBrowserBody
        loading={loading}
        error={error}
        file={file}
        listing={listing}
        path={path}
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
  crumbs,
  onPickBranch,
  onGoTo,
}: Readonly<{
  branches: RepoBranch[];
  chosenRef: string | null;
  resolvedRef: string | null;
  crumbs: Array<{ label: string; path: string }>;
  onPickBranch: (nextRef: string) => void;
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
            {branches.map((branch) => (
              <option key={branch.name} value={branch.name}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <nav className="ws-crumbs" aria-label="File path">
        <button type="button" className="ws-crumb" onClick={() => onGoTo("")}>
          root
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
    </div>
  );
}

function CodeEntries({
  listing,
  path,
  onOpen,
  onGoTo,
}: Readonly<{
  listing: RepoContentListing;
  path: string;
  onOpen: (entry: RepoContentEntry) => void;
  onGoTo: (nextPath: string) => void;
}>) {
  return (
    <ul className="ws-tree">
      {path ? (
        <li>
          <button
            type="button"
            className="ws-tree__row"
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
        <CodeEntryRow key={entry.sha || entry.path} entry={entry} onOpen={onOpen} />
      ))}
    </ul>
  );
}

function CodeEntryRow({
  entry,
  onOpen,
}: Readonly<{
  entry: RepoContentEntry;
  onOpen: (entry: RepoContentEntry) => void;
}>) {
  return (
    <li>
      <button
        type="button"
        className="ws-tree__row"
        onClick={() => onOpen(entry)}
      >
        <span className="ws-tree__icon" aria-hidden="true">
          {entry.type === "dir" ? "▸" : "•"}
        </span>
        <span className="ws-tree__name">{entry.name}</span>
        {entry.type === "file" ? (
          <span className="ws-tree__size">{formatBytes(entry.size)}</span>
        ) : null}
      </button>
    </li>
  );
}

function CodeBrowserBody({
  loading,
  error,
  file,
  listing,
  path,
  onRetry,
  onOpen,
  onGoTo,
}: Readonly<{
  loading: boolean;
  error: string | null;
  file: NonNullable<RepoContentListing["file"]> | null;
  listing: RepoContentListing | null;
  path: string;
  onRetry: () => void;
  onOpen: (entry: RepoContentEntry) => void;
  onGoTo: (nextPath: string) => void;
}>) {
  if (loading) return <WorkspaceLoading rows={6} />;
  if (error) return <WorkspaceError message={error} onRetry={onRetry} />;
  if (file) return <FileView file={file} />;
  if (listing && listing.entries.length > 0) {
    return (
      <CodeEntries
        listing={listing}
        path={path}
        onOpen={onOpen}
        onGoTo={onGoTo}
      />
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
        {file.htmlUrl && (
          <a
            className="ws-link"
            href={file.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open on GitHub ↗
          </a>
        )}
      </div>
      {file.content === null ? (
        <WorkspaceEmpty
          title="Not shown"
          message={
            file.truncated
              ? "This file is binary or too large to display. Open it on GitHub instead."
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
