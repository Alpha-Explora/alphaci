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

/**
 * The error output of whichever job failed in a run.
 *
 * `available: false` is a normal answer: GitHub expires logs, and a run can
 * conclude in failure with no failed job when the workflow itself was rejected.
 */
export interface RunFailureLogResponse {
  available: boolean;
  reason?: "no-failed-job" | "log-expired";
  jobName?: string;
  stepName?: string;
  jobUrl?: string;
  lines?: string[];
  truncated?: boolean;
  foundErrorMarker?: boolean;
}

export function getProjectRunFailureLog(projectId: string, runId: number) {
  return request<RunFailureLogResponse>(
    `/projects/${projectId}/workspace/runs/${String(runId)}/failure-log`,
  );
}

/** One check GitHub ran against a pull request's head commit. */
export interface PullRequestCheck {
  name: string;
  status: string;
  conclusion: string | null;
  detailsUrl: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * A pull request with what it takes to decide about it.
 *
 * `mergeableState` is the field that explains a refusal: `blocked` is a
 * protection rule, `dirty` a conflict, `clean` will merge, and `unknown` means
 * GitHub has not finished working it out yet.
 */
export interface PullRequestDetail extends PullRequestSummary {
  mergeable: boolean | null;
  mergeableState: string;
  headSha: string;
  body: string | null;
}

export interface PullRequestDetailResponse {
  repoFullName: string;
  pullRequest: PullRequestDetail;
  checks: PullRequestCheck[];
  /** True when the viewer opened it — GitHub forbids approving your own. */
  viewerIsAuthor: boolean;
}

/** What happened when the system asked GitHub to merge. */
export interface PullRequestMergeResponse {
  merged: boolean;
  message: string;
  sha: string | null;
}

export function getProjectPullRequestDetail(
  projectId: string,
  pullNumber: number,
) {
  return request<PullRequestDetailResponse>(
    `${base(projectId)}/pull-requests/${pullNumber}`,
  );
}

export function mergeProjectPullRequest(
  projectId: string,
  pullNumber: number,
  method: "merge" | "squash" | "rebase" = "merge",
) {
  return request<PullRequestMergeResponse>(
    `${base(projectId)}/pull-requests/${pullNumber}/merge`,
    { method: "POST", body: JSON.stringify({ method }) },
  );
}

/** One commit a comparison would bring into the base. */
export interface ComparisonCommit {
  sha: string;
  /** The first line of the commit message only. */
  headline: string;
  author: string | null;
  authoredAt: string | null;
}

/**
 * What a pull request from `head` into `base` would contain.
 *
 * `status` is GitHub's word for how the branches relate. `identical` and
 * `behind` both mean there is nothing to merge.
 */
export interface BranchComparison {
  status: "ahead" | "behind" | "diverged" | "identical";
  aheadBy: number;
  behindBy: number;
  totalCommits: number;
  commits: ComparisonCommit[];
  files: PullRequestFile[];
  /** GitHub lists at most 300 files; true means `files` is a prefix. */
  filesTruncated: boolean;
}

export interface BranchComparisonResponse {
  repoFullName: string;
  base: string;
  head: string;
  comparison: BranchComparison;
  /** A pull request already open from `head` into `base`, if any. */
  existingPullRequest: PullRequestSummary | null;
}

export interface CreatePullRequestInput {
  base: string;
  head: string;
  title: string;
  body?: string;
  draft?: boolean;
}

/**
 * GitHub's answer to opening a pull request. A refusal ("No commits between
 * main and feature") is `created: false` with GitHub's sentence, not an error.
 */
export type CreatePullRequestResponse =
  | { created: true; pullRequest: PullRequestSummary }
  | { created: false; message: string };

/* `base` is taken by the URL helper above, and it is also the natural name for
 * the base branch below; the alias keeps both readable. */
const workspaceUrl = base;

/** On open only, never polled — a comparison carries every diff. */
export function compareProjectBranches(
  projectId: string,
  base: string,
  head: string,
) {
  const query = new URLSearchParams({ base, head });
  return request<BranchComparisonResponse>(
    `${workspaceUrl(projectId)}/compare?${query.toString()}`,
  );
}

/** Opens the pull request as the signed-in person, with their GitHub token. */
export function createProjectPullRequest(
  projectId: string,
  input: CreatePullRequestInput,
) {
  return request<CreatePullRequestResponse>(
    `${workspaceUrl(projectId)}/pull-requests`,
    { method: "POST", body: JSON.stringify(input) },
  );
}
