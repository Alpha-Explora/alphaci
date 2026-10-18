"use client";

import { useEffect, useRef, useState } from "react";

import {
  getProjectFileCommits,
  type RepoFileCommits,
  type RepoPathCommit,
} from "../data/project-workspace-api";
import type { ProjectStatus } from "../../model/projects-types";

/* Re-exported so the views name these shapes without reaching into `data/`. */
export type { RepoFileCommits, RepoPathCommit };

export interface FileCommitsViewModel {
  /** `loading` until the commits for the current path and ref arrive. */
  status: ProjectStatus | "idle";
  commits: RepoFileCommits | null;
}

/**
 * The commit column of the Code tab: what last changed the open folder (or
 * file) and each entry in it, and when.
 *
 * Asked for only once the listing itself has rendered (`ref` is null until
 * then), so the files never wait on a history lookup. The answer is stored
 * with the path and ref it was for and the status is derived from that, so
 * nothing is set synchronously in the effect and a slow answer for a folder
 * already left behind is never shown for the next one.
 */
export function useFileCommitsViewModel(input: {
  projectId: string;
  path: string;
  ref: string | null;
}): FileCommitsViewModel {
  const { projectId, path, ref } = input;
  const key = ref === null ? null : `${ref}\u0000${path}`;
  const [answer, setAnswer] = useState<{
    key: string;
    commits: RepoFileCommits | null;
  } | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (ref === null || key === null) return;
    requestId.current += 1;
    const current = requestId.current;
    getProjectFileCommits(projectId, { path, ref })
      .then((commits) => {
        if (current === requestId.current) setAnswer({ key, commits });
      })
      .catch(() => {
        // The column is extra: a failure leaves the file list as it was.
        if (current === requestId.current) setAnswer({ key, commits: null });
      });
  }, [projectId, path, ref, key]);

  if (key === null) return { status: "idle", commits: null };
  if (answer?.key !== key) return { status: "loading", commits: null };
  return answer.commits
    ? { status: "ready", commits: answer.commits }
    : { status: "error", commits: null };
}

