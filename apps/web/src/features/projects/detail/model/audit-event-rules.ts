/* Pure rules for a repository's Audit tab: reading GET /projects/:id/audit
 * defensively, a human label for each event code, who did it, and when. No
 * React, no fetch.
 *
 * The response is read through `normalizeAuditPage`: an older backend sends
 * no `actorLogin`, `scope`, `metadata` or `next`, and a malformed row is
 * dropped rather than rendered half-empty. Nothing here grants anything; a
 * missing field only ever makes a row plainer. */

import type { ProjectAuditEventsResponse } from "@/shared/api/contracts";

import { commitTitle } from "./commit-list-rules";

/** Rows per request. The server defaults to 50 and caps `?limit` at 100. */
export const AUDIT_PAGE_SIZE = 50;

/**
 * 'project': the delivery Project's own events. 'github': activity read from
 * GitHub (pushes, pull requests, branches, tags) rather than done in ALPHACI.
 */
export type AuditScope = "repository" | "project" | "github";

/** One commit a push carried, as its row lists it. */
export interface AuditPushCommit {
  sha: string;
  shortSha: string;
  title: string;
}

/** One row as the Audit tab draws it. */
export interface AuditRow {
  id: string;
  eventCode: string;
  /** What happened, in words ("Pull request merged"). */
  label: string;
  /** The server's own sentence, when it says more than the label. */
  detail: string | null;
  /** The actor's GitHub login, or "System". */
  actor: string;
  createdAt: string;
  /** 'project': recorded against the delivery Project this repository is filed under. */
  scope: AuditScope;
  /** Recovered from the outbox after it was first dropped. */
  restored: boolean;
  /** A `github.push` row's commits, as the server listed them; empty otherwise. */
  commits: AuditPushCommit[];
  /** How many more the push carried than are listed (GitHub caps the list). */
  moreCommits: number;
}

/** How fresh the GitHub rows are; null when the backend does not read GitHub. */
export interface AuditGithubSync {
  status: "ok" | "stale" | "failed";
  syncedAt: string | null;
}

export interface AuditPage {
  /** False: audit recording is off for this deployment. */
  enabled: boolean;
  items: AuditRow[];
  /** Pass back unchanged as `?before=` for the next page; null on the last one. */
  next: string | null;
  githubSync: AuditGithubSync | null;
}

/* ── Labels ──────────────────────────────────────────────────────────────── */

const EVENT_LABELS: Readonly<Record<string, string>> = {
  project_created: "Repository created",
  "project.updated": "Repository settings updated",
  project_deleted_webhook: "Repository removed on GitHub",
  project_deleted_reconciliation: "Repository removed",
  project_sync_completed: "Snapshot synced",
  project_snapshot_synced: "Snapshot synced",
  project_github_repo_deleted: "GitHub repository deleted",
  project_github_repo_delete_failed: "GitHub repository could not be deleted",
  project_github_repo_delete_rejected: "GitHub repository delete refused",
  project_github_repo_delete_missing_scope: "GitHub repository delete needs more access",
  project_sonar_project_deleted: "SonarCloud project deleted",
  project_sonar_project_delete_failed: "SonarCloud project could not be deleted",
  deployment_target_created: "Hosting service added",
  deployment_target_failed: "Hosting service setup failed",
  deployment_target_updated: "Hosting service updated",
  deployment_target_synced: "Hosting service synced",
  deployment_target_detached: "Hosting service detached",
  deployment_target_ci_secrets_reinstalled: "Deployment secrets reinstalled",
  deployment_provider_resources_deleted: "Hosting resources deleted",
  env_vars_provisioned: "Environment variables set",
  env_var_removed: "Environment variable removed",
  ci_token_rotated: "CI token rotated",
  drift_detected: "Drift detected",
  drift_repair_completed: "Drift repaired",
  quota_blocked: "Blocked by a usage limit",
  pull_request_created: "Pull request opened",
  pull_request_merged: "Pull request merged",
  workflow_pr_created: "Workflow update pull request opened",
  "qa.run.created": "QA run started",
  "qa.run.signed_off": "QA run signed off",
  "qa.run.reopened": "QA run reopened",
  "qa.item.status_changed": "QA item status changed",
  "qa.item.returned_to_dev": "QA item returned to development",
  "qa.item.blocked": "QA item blocked",
  "qa.item.retest_requested": "Re-test requested",
  "qa.automation.dispatched": "Automated tests started",
  "qa.promotion.merged": "Merged to main",
  "qa.requirement.created": "Requirement added",
  "qa.requirement.updated": "Requirement updated",
  "qa.requirement.archived": "Requirement archived",
  "qa.requirement.progress_changed": "Requirement progress changed",
  "qa.checklist.created": "Checklist created",
  "qa.checklist.updated": "Checklist updated",
  "qa.checklist.shared": "Checklist shared",
  "qa.checklist.archived": "Checklist archived",
  "hierarchy.delivery_project.created": "Project created",
  "hierarchy.delivery_project.updated": "Project updated",
  "hierarchy.delivery_project.archived": "Project archived",
  "hierarchy.delivery_project.deleted": "Project deleted",
  "hierarchy.repository.created": "Repository added to the team",
  "hierarchy.repository.archived": "Repository archived",
  "hierarchy.repository.moved": "Repository moved to another Project",
  "hierarchy.configuration.variable_written": "Repository variable saved",
  "hierarchy.configuration.variable_deleted": "Repository variable deleted",
  "hierarchy.configuration.secret_written": "Repository secret saved",
  "hierarchy.configuration.secret_deleted": "Repository secret deleted",
};

/** A code this file does not know yet, by family: still says roughly what. */
const FAMILY_LABELS: ReadonlyArray<readonly [prefix: string, label: string]> = [
  ["qa.checklist.", "Checklist changed"],
  ["qa.requirement.", "Requirement changed"],
  ["qa.run.", "QA run changed"],
  ["qa.item.", "QA item changed"],
  ["hierarchy.delivery_project.", "Project changed"],
  ["hierarchy.repository.", "Repository changed"],
  ["hierarchy.group.", "Team changed"],
  ["hierarchy.assignment.", "Developer access changed"],
  ["hierarchy.configuration.", "Repository configuration changed"],
  ["deployment_target_", "Hosting service changed"],
  ["github.pull_request.", "Pull request activity on GitHub"],
  ["github.", "GitHub activity"],
];

/** "deployment_window_closed" -> "Deployment window closed". */
function humanizeCode(code: string): string {
  const words = code.replace(/[._]+/g, " ").trim();
  if (!words) return "Activity";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * A human label for an event. Known codes get a fixed sentence; an unknown
 * code of a known family gets the family's; anything else uses the server's
 * own message, then the code itself in words.
 */
export function auditEventLabel(eventCode: string, message: string | null | undefined): string {
  const known = EVENT_LABELS[eventCode];
  if (known) return known;
  const family = FAMILY_LABELS.find(([prefix]) => eventCode.startsWith(prefix));
  if (family) return family[1];
  const text = message?.trim();
  return text || humanizeCode(eventCode);
}

/** The server's sentence, unless it only repeats the label. */
function auditDetail(label: string, message: string | null): string | null {
  if (!message) return null;
  return message.trim().toLowerCase() === label.toLowerCase() ? null : message;
}

/** The actor's login, else "System" (a scheduled job, a webhook, an unknown user). */
export function auditActorLabel(actorLogin: string | null | undefined): string {
  const login = actorLogin?.trim();
  return login || "System";
}

/* ── GitHub activity ─────────────────────────────────────────────────────── */

type Metadata = Readonly<Record<string, unknown>>;

function metaText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function wholeNumber(value: unknown, min: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min ? value : null;
}

/** "pull request #12", or "a pull request" when the number is missing. */
function pullRequestRef(meta: Metadata): string {
  const number = wholeNumber(meta.number, 1);
  return number === null ? "a pull request" : `pull request #${number}`;
}

function withPart(base: string, joiner: string, part: string | null): string {
  return part ? `${base}${joiner}${part}` : base;
}

/** "approved", "changes requested", "commented"; null when the state is missing. */
function reviewState(meta: Metadata): string | null {
  const state = metaText(meta.state);
  return state ? state.replace(/[_-]+/g, " ").toLowerCase() : null;
}

/** The branch or tag a ref event names, without its refs/heads/ prefix. */
function refName(meta: Metadata): string | null {
  const ref = metaText(meta.ref) ?? metaText(meta.branch) ?? metaText(meta.tag) ?? metaText(meta.name);
  return ref ? ref.replace(/^refs\/(heads|tags)\//, "") : null;
}

/** A push's listed commits, read defensively: a commit without a SHA is dropped. */
export function auditPushCommits(meta: Metadata): AuditPushCommit[] {
  const listed = Array.isArray(meta.commits) ? meta.commits : [];
  return listed.flatMap((value): AuditPushCommit[] => {
    const raw = typeof value === "object" && value !== null ? (value as Metadata) : {};
    const sha = metaText(raw.sha);
    if (!sha) return [];
    return [{ sha, shortSha: sha.slice(0, 7), title: commitTitle(metaText(raw.message)) }];
  });
}

/** How many commits the push carried: `size`, else the listed ones; null when unknown. */
function pushSize(meta: Metadata): number | null {
  const size = wholeNumber(meta.size, 0);
  if (size !== null) return size;
  const listed = auditPushCommits(meta).length;
  return listed > 0 ? listed : null;
}

/** "Pushed 3 commits to dev", "Force-pushed 1 commit to uat", "Pushed to dev". */
function pushLabel(meta: Metadata): string {
  const verb = meta.forced === true ? "Force-pushed" : "Pushed";
  const size = pushSize(meta);
  const what = size ? `${verb} ${size} commit${size === 1 ? "" : "s"}` : verb;
  return withPart(what, " to ", metaText(meta.branch));
}

function reviewLabel(meta: Metadata): string {
  const state = reviewState(meta);
  return withPart(`Reviewed ${pullRequestRef(meta)}`, "", state ? ` (${state})` : null);
}

const GITHUB_LABELS: Readonly<Record<string, (meta: Metadata) => string>> = {
  "github.push": pushLabel,
  "github.pull_request.opened": (meta) => withPart(`Opened ${pullRequestRef(meta)}`, ": ", metaText(meta.title)),
  "github.pull_request.merged": (meta) => withPart(`Merged ${pullRequestRef(meta)}`, " into ", metaText(meta.base)),
  "github.pull_request.closed": (meta) => `Closed ${pullRequestRef(meta)}`,
  "github.pull_request.reopened": (meta) => `Reopened ${pullRequestRef(meta)}`,
  "github.pull_request.reviewed": reviewLabel,
  "github.branch.created": (meta) => withPart("Created branch", " ", refName(meta)),
  "github.branch.deleted": (meta) => withPart("Deleted branch", " ", refName(meta)),
  "github.tag.created": (meta) => withPart("Created tag", " ", refName(meta)),
  "github.tag.deleted": (meta) => withPart("Deleted tag", " ", refName(meta)),
};

/**
 * The sentence for a GitHub event, built from its metadata ("Merged pull
 * request #12 into uat"); null for a code that is not GitHub's or not known.
 */
export function githubEventLabel(eventCode: string, metadata: Metadata | null | undefined): string | null {
  const label = GITHUB_LABELS[eventCode];
  return label ? label(metadata ?? {}) : null;
}

/* ── Time ────────────────────────────────────────────────────────────────── */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5m ago", "3h ago", "2d ago"; "" for an unreadable time. */
export function auditRelativeTime(iso: string, now: number): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "";
  const elapsed = Math.max(0, now - at);
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  return `${Math.floor(elapsed / DAY)}d ago`;
}

/** The exact time, for the hover title: the viewer's locale and time zone. */
export function auditAbsoluteTime(iso: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(at);
}

/* ── Reading the response ────────────────────────────────────────────────── */

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

const SCOPES: ReadonlyArray<AuditScope> = ["repository", "project", "github"];

/** The row's scope; an older backend's unscoped `github.*` row still reads as GitHub's. */
function scopeOf(scope: unknown, eventCode: string): AuditScope {
  const known = SCOPES.find((entry) => entry === scope);
  if (known) return known;
  return eventCode.startsWith("github.") ? "github" : "repository";
}

/** What the row says: GitHub's sentence (no detail: the message repeats it), else the known label. */
function describe(eventCode: string, message: string | null, metadata: Metadata): Pick<AuditRow, "label" | "detail"> {
  const github = githubEventLabel(eventCode, metadata);
  if (github) return { label: github, detail: null };
  const label = auditEventLabel(eventCode, message);
  return { label, detail: auditDetail(label, message) };
}

/** A push's listed commits and how many it carried beyond them. */
function pushCommitsOf(eventCode: string, metadata: Metadata): Pick<AuditRow, "commits" | "moreCommits"> {
  if (eventCode !== "github.push") return { commits: [], moreCommits: 0 };
  const commits = auditPushCommits(metadata);
  const size = wholeNumber(metadata.size, 0) ?? commits.length;
  return { commits, moreCommits: Math.max(0, size - commits.length) };
}

function rowFrom(value: unknown): AuditRow | null {
  const raw = record(value);
  const id = text(raw?.id);
  const eventCode = text(raw?.eventCode);
  const createdAt = text(raw?.createdAt);
  if (!raw || !id || !eventCode || !createdAt) return null;
  const metadata = record(raw.metadata) ?? {};
  return {
    id,
    eventCode,
    ...describe(eventCode, text(raw.message), metadata),
    // GitHub activity names its actor in actorLogin, else metadata.githubLogin.
    actor: auditActorLabel(text(raw.actorLogin) ?? text(metadata.githubLogin)),
    createdAt,
    scope: scopeOf(raw.scope, eventCode),
    restored: metadata.backfilledFromOutbox === true,
    ...pushCommitsOf(eventCode, metadata),
  };
}

const SYNC_STATUSES: ReadonlyArray<AuditGithubSync["status"]> = ["ok", "stale", "failed"];

/** `githubSync`, read defensively; null when absent or unreadable (no sync line). */
export function normalizeGithubSync(value: unknown): AuditGithubSync | null {
  const raw = record(value);
  const status = SYNC_STATUSES.find((entry) => entry === raw?.status);
  if (!status) return null;
  return { status, syncedAt: text(raw?.syncedAt) };
}

/** One page of the response, read defensively. */
export function normalizeAuditPage(value: ProjectAuditEventsResponse | unknown): AuditPage {
  const raw = record(value);
  const items = Array.isArray(raw?.items) ? raw.items : [];
  return {
    enabled: raw?.enabled !== false,
    items: items.map(rowFrom).filter((row): row is AuditRow => row !== null),
    next: text(raw?.next),
    githubSync: normalizeGithubSync(raw?.githubSync),
  };
}

/** A further page appended to what is shown, without repeating a row. */
export function appendAuditPage(current: AuditPage, page: AuditPage): AuditPage {
  const seen = new Set(current.items.map((row) => row.id));
  return {
    enabled: current.enabled && page.enabled,
    items: [...current.items, ...page.items.filter((row) => !seen.has(row.id))],
    next: page.next,
    githubSync: page.githubSync ?? current.githubSync,
  };
}

/** What the tab says when there are no rows. */
export function auditEmptyMessage(enabled: boolean): string {
  return enabled ? "No activity recorded yet." : "Audit recording is turned off for this deployment.";
}

export function auditLoadMoreLabel(loading: boolean): string {
  return loading ? "Loading..." : "Load more";
}

/* ── GitHub sync line and the source filter ─────────────────────────────── */

export interface AuditSyncLine {
  tone: "ok" | "warning";
  text: string;
}

/**
 * The line above the trail: when GitHub activity was last read, or that the
 * last read did not land and the rows are what was saved. Null without a
 * `githubSync` (an older backend): no line at all.
 */
export function auditSyncLine(sync: AuditGithubSync | null, now: number): AuditSyncLine | null {
  if (!sync) return null;
  const ago = sync.syncedAt ? auditRelativeTime(sync.syncedAt, now) : "";
  if (sync.status === "ok") {
    return { tone: "ok", text: ago ? `GitHub activity synced ${ago}` : "GitHub activity synced" };
  }
  const last = ago ? ` (last synced ${ago})` : "";
  return { tone: "warning", text: `Couldn't reach GitHub just now — showing what was saved${last}` };
}

export function auditSyncButtonLabel(syncing: boolean): string {
  return syncing ? "Syncing..." : "Sync now";
}

export type AuditFilter = "all" | "alphaci" | "github";

export const AUDIT_FILTERS: ReadonlyArray<{ id: AuditFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "alphaci", label: "ALPHACI" },
  { id: "github", label: "GitHub" },
];

export function isGithubAuditRow(row: Pick<AuditRow, "scope">): boolean {
  return row.scope === "github";
}

/** The rows a filter keeps, from what is loaded (the filter does not ask the server). */
export function filterAuditRows(rows: ReadonlyArray<AuditRow>, filter: AuditFilter): AuditRow[] {
  if (filter === "all") return [...rows];
  const github = filter === "github";
  return rows.filter((row) => isGithubAuditRow(row) === github);
}

/** The chips are offered once the trail can hold GitHub activity at all. */
export function showAuditFilters(rows: ReadonlyArray<AuditRow>, sync: AuditGithubSync | null): boolean {
  return sync !== null || rows.some(isGithubAuditRow);
}

/** What a filter with nothing to show says. */
export function auditFilterEmptyMessage(filter: AuditFilter): string {
  if (filter === "github") return "No GitHub activity among the loaded events.";
  if (filter === "alphaci") return "No ALPHACI events among the loaded events.";
  return "No activity recorded yet.";
}

/** The push row's disclosure: "3 commits" / "Hide commits". */
export function pushCommitsToggleLabel(count: number, open: boolean): string {
  if (open) return "Hide commits";
  return `${count} commit${count === 1 ? "" : "s"}`;
}
