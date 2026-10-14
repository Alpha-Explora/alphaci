/* Reading the team's QA overview off the wire. Pure: no React, no fetch.
 *
 * Every field is read through a reader, so a missing or malformed value from
 * an older backend becomes "not known" (null), never a zero that would read
 * as a fact, and never a crash. A Project or requirement without an id is
 * dropped. */

import type { QaRunStatus, QaVerdict } from "./qa-run-types";
import type { ProgressCounts, RequirementKind } from "./requirement-types";
import type {
  TeamQaDefectCounts,
  TeamQaIteration,
  TeamQaLatestRun,
  TeamQaMembership,
  TeamQaOverview,
  TeamQaOverviewSupport,
  TeamQaProject,
  TeamQaProjectCounts,
  TeamQaPromotion,
  TeamQaRequirementSummary,
  TeamQaVerificationCounts,
} from "./team-qa-overview-types";
import { oneOf, positiveInt, record, records, text, type Loose } from "./wire-readers";

const KINDS: ReadonlyArray<RequirementKind> = ["functional", "system"];
const RUN_STATUSES: ReadonlyArray<QaRunStatus> = ["open", "signed_off"];
const VERDICTS: ReadonlyArray<QaVerdict> = ["APPROVED", "REJECTED", "CONDITIONAL"];
const MEMBERSHIPS: ReadonlyArray<TeamQaMembership> = ["developer", "qa"];
const ITERATION_STATUSES: ReadonlyArray<TeamQaIteration["status"]> = ["active", "delivered"];

function countOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function count(value: unknown): number {
  return countOrNull(value) ?? 0;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function verificationFrom(value: unknown): TeamQaVerificationCounts | null {
  const raw = record(value);
  if (!raw) return null;
  return {
    pending: count(raw.pending),
    passed: count(raw.passed),
    failed: count(raw.failed),
    blocked: count(raw.blocked),
    returned_to_dev: count(raw.returned_to_dev),
  };
}

function progressFrom(value: unknown): ProgressCounts {
  const raw = record(value) ?? {};
  return { todo: count(raw.todo), in_progress: count(raw.in_progress), done: count(raw.done) };
}

function requirementFrom(raw: Loose): TeamQaRequirementSummary | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    kind: oneOf(raw.kind, KINDS) ?? "system",
    name: text(raw.name) ?? "Untitled requirement",
    itemCount: count(raw.itemCount),
    progressCounts: progressFrom(raw.progressCounts),
    verification: verificationFrom(raw.verification),
    latestRunStatus: oneOf(raw.latestRunStatus, RUN_STATUSES),
    archivedAt: text(raw.archivedAt),
  };
}

/** A name sent as text, or as an actor object with a login. */
function actorName(value: unknown): string | null {
  return text(value) ?? text(record(value)?.login);
}

function latestRunFrom(value: unknown): TeamQaLatestRun | null {
  const raw = record(value) ?? {};
  const id = text(raw.id);
  const status = oneOf(raw.status, RUN_STATUSES);
  if (!id || !status) return null;
  return {
    id,
    status,
    createdAt: text(raw.createdAt),
    verdict: oneOf(raw.verdict, VERDICTS),
    signedOffAt: text(raw.signedOffAt),
    signedOffBy: actorName(raw.signedOffBy),
  };
}

function defectsFrom(value: unknown): TeamQaDefectCounts | null {
  const raw = record(value);
  if (!raw) return null;
  return {
    blocker: count(raw.blocker),
    major: count(raw.major),
    minor: count(raw.minor),
    unrated: count(raw.unrated),
  };
}

function membersFrom(value: unknown): TeamQaProjectCounts["members"] {
  const raw = record(value);
  if (!raw) return null;
  return { developer: count(raw.developer), qa: count(raw.qa) };
}

function countsFrom(value: unknown): TeamQaProjectCounts {
  const raw = record(value) ?? {};
  return {
    readyForQa: countOrNull(raw.readyForQa),
    openDefects: defectsFrom(raw.openDefects),
    members: membersFrom(raw.members),
  };
}

function promotionFrom(value: unknown): TeamQaPromotion | null {
  const raw = record(value) ?? {};
  const totalRepositories = countOrNull(raw.totalRepositories);
  if (totalRepositories === null) return null;
  return {
    mergedRepositories: count(raw.mergedRepositories),
    totalRepositories,
    lastMergedAt: text(raw.lastMergedAt),
  };
}

function iterationFrom(value: unknown): TeamQaIteration | null {
  const raw = record(value);
  const number = positiveInt(raw?.number);
  const status = oneOf(raw?.status, ITERATION_STATUSES);
  if (!number || !status) return null;
  return { number, status, deliveredAt: text(raw?.deliveredAt) };
}

function projectFrom(group: Loose): TeamQaProject | null {
  const deliveryProject = record(group.deliveryProject) ?? {};
  const id = text(deliveryProject.id);
  if (!id) return null;
  return {
    deliveryProject: { id, name: text(deliveryProject.name) ?? "Project" },
    requirements: records(group.requirements).map(requirementFrom).filter(isPresent),
    latestRun: latestRunFrom(group.latestRun),
    counts: countsFrom(group.counts),
    promotion: promotionFrom(group.promotion),
    viewerMembership: oneOf(group.viewerMembership, MEMBERSHIPS),
    iteration: iterationFrom(group.iteration),
  };
}

function supportsFrom(groups: ReadonlyArray<Loose>): TeamQaOverviewSupport {
  return {
    latestRun: groups.some((group) => "latestRun" in group),
    counts: groups.some((group) => record(group.counts) !== null),
    promotion: groups.some((group) => "promotion" in group),
    viewerMembership: groups.some((group) => "viewerMembership" in group),
  };
}

/** GET /workspaces/:ws/qa-requirements/overview, normalised. A body that is not one reads as empty. */
export function normalizeTeamQaOverview(value: unknown): TeamQaOverview {
  const groups = records(record(value)?.groups);
  return {
    projects: groups.map(projectFrom).filter(isPresent),
    supports: supportsFrom(groups),
  };
}
