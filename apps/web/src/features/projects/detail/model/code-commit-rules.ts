/* The Code tab's commit column. Pure: no React, no fetch. */
import type { RepoFileCommits, RepoPathCommit } from "../data/project-workspace-api";

/** "1 Commit", "288 Commits": the count beside the latest commit. */
export function commitCountLabel(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "Commit" : "Commits"}`;
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

