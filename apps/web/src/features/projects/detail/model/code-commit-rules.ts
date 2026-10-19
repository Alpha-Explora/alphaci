/* The Code tab's commit column. Pure: no React, no fetch. */
import type { RepoFileCommits, RepoPathCommit } from "../data/project-workspace-api";

/** "1 Commit", "288 Commits": the count beside the latest commit. */
export function commitCountLabel(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "Commit" : "Commits"}`;
}

/**
 * A commit the Code tab browses instead of a branch, opened from the Commits
 * tab's "Browse files". `branch` is where it was listed, for the way back.
 */
export interface BrowseCommit {
  sha: string;
  shortSha: string;
  branch: string | null;
}

/** "Back to uat": leaves a browsed commit for the branch it was listed on. */
export function browseCommitBackLabel(branch: string | null): string {
  return branch ? `Back to ${branch}` : "Back to the branch";
}

/** The ref the Code tab asks for first: the browsed commit's SHA, else none (the server's default). */
export function browseCommitRef(commit: BrowseCommit | null): string | null {
  return commit ? commit.sha : null;
}

/** Where "Back to …" goes: the commit's branch, else none (the server's default). */
export function browseCommitBranch(commit: BrowseCommit | null): string | null {
  return commit ? commit.branch : null;
}

/** The entry's latest commit, or null while unknown or when there is none. */
export function entryCommit(
  commits: RepoFileCommits | null,
  path: string,
): RepoPathCommit | null {
  return commits?.entries[path] ?? null;
}

/** Who to name for a commit: the GitHub login, else the git author name. */
export function commitAuthorLabel(
  commit: Pick<RepoPathCommit, "authorLogin" | "authorName">,
): string {
  return commit.authorLogin ?? commit.authorName ?? "Unknown author";
}

