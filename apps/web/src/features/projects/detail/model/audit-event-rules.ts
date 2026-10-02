/* Pure rules for a repository's Audit tab: reading GET /projects/:id/audit
 * defensively, a human label for each event code, who did it, and when. No
 * React, no fetch.
 *
 * The response is read through `normalizeAuditPage`: an older backend sends
 * no `actorLogin`, `scope`, `metadata` or `next`, and a malformed row is
 * dropped rather than rendered half-empty. Nothing here grants anything; a
 * missing field only ever makes a row plainer. */

import type { ProjectAuditEventsResponse } from "@/shared/api/contracts";

/** Rows per request. The server defaults to 50 and caps `?limit` at 100. */
export const AUDIT_PAGE_SIZE = 50;

export type AuditScope = "repository" | "project";

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
}

export interface AuditPage {
  /** False: audit recording is off for this deployment. */
  enabled: boolean;
  items: AuditRow[];
  /** Pass back unchanged as `?before=` for the next page; null on the last one. */
  next: string | null;
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

function rowFrom(value: unknown): AuditRow | null {
  const raw = record(value);
  const id = text(raw?.id);
  const eventCode = text(raw?.eventCode);
  const createdAt = text(raw?.createdAt);
  if (!raw || !id || !eventCode || !createdAt) return null;
  const message = text(raw.message);
  const label = auditEventLabel(eventCode, message);
  return {
    id,
    eventCode,
    label,
    detail: auditDetail(label, message),
    actor: auditActorLabel(text(raw.actorLogin)),
    createdAt,
    scope: raw.scope === "project" ? "project" : "repository",
    restored: record(raw.metadata)?.backfilledFromOutbox === true,
  };
}

/** One page of the response, read defensively. */
export function normalizeAuditPage(value: ProjectAuditEventsResponse | unknown): AuditPage {
  const raw = record(value);
  const items = Array.isArray(raw?.items) ? raw.items : [];
  return {
    enabled: raw?.enabled !== false,
    items: items.map(rowFrom).filter((row): row is AuditRow => row !== null),
    next: text(raw?.next),
  };
}

/** A further page appended to what is shown, without repeating a row. */
export function appendAuditPage(current: AuditPage, page: AuditPage): AuditPage {
  const seen = new Set(current.items.map((row) => row.id));
  return {
    enabled: current.enabled && page.enabled,
    items: [...current.items, ...page.items.filter((row) => !seen.has(row.id))],
    next: page.next,
  };
}

/** What the tab says when there are no rows. */
export function auditEmptyMessage(enabled: boolean): string {
  return enabled ? "No activity recorded yet." : "Audit recording is turned off for this deployment.";
}

export function auditLoadMoreLabel(loading: boolean): string {
  return loading ? "Loading..." : "Load more";
}
