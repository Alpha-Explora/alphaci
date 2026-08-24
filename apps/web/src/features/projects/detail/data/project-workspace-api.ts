import { request } from "@/shared/api/request";

/**
 * The read-only GitHub views behind a project's Code, Pull requests and
 * Pipeline runs tabs.
 *
 * These are the only calls in the product that read GitHub live on every
 * request, and they share one rule that exists to protect the organisation's
 * shared rate limit:
 *
 *   listWorkflowRuns   — safe to poll
 *   getRunJobs         — call when someone opens a run, never inside a poll
 *   getJobLog          — call when someone opens a job, never polled
 *
 * Fetching jobs inside the run poll is how a few open tabs exhaust the hourly
 * budget and every other GitHub call in the product starts failing.
 */

const enc = encodeURIComponent;

export interface RepoBranch {
  name: string;
  protected: boolean;
  commitSha: string;
}

export interface ProjectBranchesResponse {
  defaultBranch: string;
  branches: RepoBranch[];
}

export type RepoEntryType = "file" | "dir" | "symlink" | "submodule";

export interface RepoContentEntry {
  name: string;
  path: string;
  type: RepoEntryType;
  size: number;
  sha: string;
}

export interface RepoFileContent {
  name: string;
  path: string;
  size: number;
  sha: string;
  /** UTF-8 text, or null when the file is binary or over the size cap. */
  content: string | null;
  truncated: boolean;
  htmlUrl: string | null;
}

/**
 * One response covers both a directory and a file, because the browser cannot
 * know which it asked for until the answer arrives: `entries` is populated for
 * a directory, `file` for a file, never both.
 */
export interface RepoContentListing {
  path: string;
  ref: string;
  entries: RepoContentEntry[];
  file: RepoFileContent | null;
}

export interface WorkflowRunSummary {
  id: number;
  name: string;
  displayTitle: string;
  headBranch: string;
  headSha: string;
  event: string;
  status: string;
  conclusion: string | null;
  runNumber: number;
  runAttempt: number;
  htmlUrl: string;
  actor: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWorkflowRunsResponse {
  repoFullName: string;
  actionsUrl: string;
  runs: WorkflowRunSummary[];
}

export interface RunStep {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface RunJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  htmlUrl: string | null;
  steps: RunStep[];
}

export interface JobLogResponse {
  available: boolean;
  content: string;
  truncated: boolean;
}

export interface PullRequestSummary {
  number: number;
  title: string;
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
  htmlUrl: string;
  headRef: string;
  baseRef: string;
  author: string | null;
  authorAvatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
}

export interface ProjectPullRequestsResponse {
  repoFullName: string;
  pullsUrl: string;
  pullRequests: PullRequestSummary[];
}

export interface PullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  /** The unified diff, or null for binary files and very large patches. */
  patch: string | null;
}

const base = (projectId: string) => `/projects/${enc(projectId)}/workspace`;

export function getProjectBranches(projectId: string) {
  return request<ProjectBranchesResponse>(`${base(projectId)}/branches`);
}

/** Omit `ref` on a cold open — the server resolves the default branch. */
export function getProjectFiles(
  projectId: string,
  params: { path?: string; ref?: string | null } = {},
) {
  const query = new URLSearchParams();
  if (params.path) query.set("path", params.path);
  if (params.ref) query.set("ref", params.ref);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<RepoContentListing>(`${base(projectId)}/files${suffix}`);
}

/** Safe to poll. */
export function getProjectWorkflowRuns(
  projectId: string,
  branch?: string | null,
) {
  const suffix = branch ? `?branch=${enc(branch)}` : "";
  return request<ProjectWorkflowRunsResponse>(
    `${base(projectId)}/runs${suffix}`,
  );
}

/** On open only. Never call this from inside a poll. */
export function getProjectRunJobs(projectId: string, runId: number) {
  return request<RunJob[]>(`${base(projectId)}/runs/${runId}/jobs`);
}

/** On open only, never polled — the largest response in the product. */
export function getProjectJobLog(projectId: string, jobId: number) {
  return request<JobLogResponse>(`${base(projectId)}/jobs/${jobId}/logs`);
}

export function getProjectPullRequests(
  projectId: string,
  state: "open" | "closed" | "all" = "all",
) {
  return request<ProjectPullRequestsResponse>(
    `${base(projectId)}/pull-requests?state=${state}`,
  );
}

export function getProjectPullRequestFiles(
  projectId: string,
  pullNumber: number,
) {
  return request<PullRequestFile[]>(
    `${base(projectId)}/pull-requests/${pullNumber}/files`,
  );
}
