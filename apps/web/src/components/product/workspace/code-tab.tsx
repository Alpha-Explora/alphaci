"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getProjectBranches,
  getProjectFiles,
  type RepoBranch,
  type RepoContentEntry,
  type RepoContentListing,
} from "@/lib/api/client";

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
  const [ref, setRef] = useState<string | null>(null);
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
        setRef((current) => current ?? data.defaultBranch);
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

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProjectFiles(projectId, { path, ref })
      .then((data) => {
        if (cancelled) return;
        setListing(data);
        // The server resolves the ref on a cold open; adopt whatever it chose
        // so the picker stops reading as "no branch".
        setRef((current) => current ?? data.ref);
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
  }, [projectId, path, ref]);

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

  function openEntry(entry: RepoContentEntry) {
    // Only directories and files are navigable. A symlink or submodule points
    // somewhere this browser cannot follow, so it renders as a dead row rather
    // than a link that would 404.
    if (entry.type === "dir" || entry.type === "file") setPath(entry.path);
  }

  const file = listing?.file ?? null;

  return (
    <div className="ws-panel">
      <div className="ws-toolbar">
        {branches.length > 0 && (
          <label className="ws-branch">
            <span className="ws-branch__label">Branch</span>
            <select
              className="ws-select"
              value={ref ?? ""}
              onChange={(event) => {
                setRef(event.target.value);
                // A path is only valid within the branch it was found in, so
                // switching branches returns to the root rather than 404ing on
                // a file that exists in one branch and not the other.
                setPath("");
              }}
            >
              {branches.map((branch) => (
                <option key={branch.name} value={branch.name}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <nav className="ws-crumbs" aria-label="File path">
          <button type="button" className="ws-crumb" onClick={() => setPath("")}>
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
                onClick={() => setPath(crumb.path)}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </nav>
      </div>

      {loading ? (
        <WorkspaceLoading rows={6} />
      ) : error ? (
        <WorkspaceError message={error} onRetry={load} />
      ) : file ? (
        <FileView file={file} />
      ) : listing && listing.entries.length > 0 ? (
        <ul className="ws-tree">
          {path && (
            <li>
              <button
                type="button"
                className="ws-tree__row"
                onClick={() =>
                  setPath(path.split("/").slice(0, -1).join("/"))
                }
              >
                <span className="ws-tree__icon" aria-hidden="true">
                  ↰
                </span>
                <span className="ws-tree__name">..</span>
              </button>
            </li>
          )}
          {listing.entries.map((entry) => (
            <li key={entry.sha || entry.path}>
              <button
                type="button"
                className="ws-tree__row"
                onClick={() => openEntry(entry)}
              >
                <span className="ws-tree__icon" aria-hidden="true">
                  {entry.type === "dir" ? "▸" : "•"}
                </span>
                <span className="ws-tree__name">{entry.name}</span>
                {entry.type === "file" && (
                  <span className="ws-tree__size">{formatBytes(entry.size)}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <WorkspaceEmpty
          title="Nothing here"
          message="This branch has no files at this path yet."
        />
      )}
    </div>
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
