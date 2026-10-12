/* The words Home's role blocks use. Pure: no React, no fetch. */

import type {
  ProjectTone,
  StageStatus,
  TeamQaDefectCounts,
  TeamQaVerificationCounts,
} from "./home-types";
import type {
  ReadyForProductionRow,
  UatAutomationRow,
  VerificationRow,
} from "./home-persona-types";
import { timeAgo } from "./home-rules";

/** "1 item" / "3 items". */
export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export interface Badge {
  label: string;
  tone: ProjectTone;
}

const VERDICT_BADGES: Readonly<Record<NonNullable<VerificationRow["verdict"]>, Badge>> = {
  APPROVED: { label: "Approved", tone: "ok" },
  CONDITIONAL: { label: "Conditional", tone: "warn" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

/** An open run says so; a signed-off run says its verdict. */
export function runStatusBadge(status: VerificationRow["status"], verdict: VerificationRow["verdict"]): Badge {
  if (status === "open") return { label: "Open", tone: "warn" };
  return verdict ? VERDICT_BADGES[verdict] : { label: "Signed off", tone: "muted" };
}

export function verdictBadge(verdict: ReadyForProductionRow["verdict"]): Badge {
  return VERDICT_BADGES[verdict];
}

export interface LabelledSegment {
  key: string;
  value: number;
  label: string;
}

/** Passed, failed, blocked, returned and pending, in the order the bar draws them. */
export function verificationSegments(counts: TeamQaVerificationCounts): LabelledSegment[] {
  return [
    { key: "passed", value: counts.passed, label: "passed" },
    { key: "failed", value: counts.failed, label: "failed" },
    { key: "blocked", value: counts.blocked, label: "blocked" },
    { key: "returned", value: counts.returned_to_dev, label: "returned" },
    { key: "pending", value: counts.pending, label: "pending" },
  ];
}

export function defectSegments(defects: TeamQaDefectCounts): LabelledSegment[] {
  return [
    { key: "blocker", value: defects.blocker, label: "blocker" },
    { key: "major", value: defects.major, label: "major" },
    { key: "minor", value: defects.minor, label: "minor" },
    { key: "unrated", value: defects.unrated, label: "unrated" },
  ];
}

export function segmentTotal(segments: ReadonlyArray<LabelledSegment>): number {
  return segments.reduce((sum, segment) => sum + segment.value, 0);
}

/** "5 passed · 1 failed", leaving out zeros; `empty` when every part is zero. */
export function segmentSummary(segments: ReadonlyArray<LabelledSegment>, empty: string): string {
  const parts = segments.filter((segment) => segment.value > 0).map((segment) => `${segment.value} ${segment.label}`);
  return parts.length ? parts.join(" · ") : empty;
}

const VERIFY_LABELS: Readonly<Partial<Record<StageStatus, string>>> = {
  success: "Verify passed",
  failure: "Verify failed",
  running: "Verify running",
  cancelled: "Verify cancelled",
};

/** The verify stage of a uat run, in words. A stage that never ran says so. */
export function verifyStatusLabel(status: StageStatus): string {
  return VERIFY_LABELS[status] ?? "Verify not run";
}

export function verifyTone(status: StageStatus): ProjectTone {
  if (status === "success") return "ok";
  if (status === "failure") return "danger";
  if (status === "running") return "warn";
  return "muted";
}

/** "48 of 50 tests passed", or null when the stage reported no tests. */
export function testsLabel(tests: UatAutomationRow["tests"]): string | null {
  if (!tests || tests.total === 0) return null;
  return `${tests.passed} of ${tests.total} tests passed`;
}

/** "Signed off by ana · 2d ago", with whatever of the two the server sent. */
export function signedOffLine(row: Pick<ReadyForProductionRow, "signedOffBy" | "signedOffAt">, now?: number): string {
  const by = row.signedOffBy ? ` by ${row.signedOffBy}` : "";
  const at = row.signedOffAt ? ` · ${timeAgo(row.signedOffAt, now)}` : "";
  return `Signed off${by}${at}`;
}

/** "1 of 2 repositories merged". */
export function mergedLabel(row: Pick<ReadyForProductionRow, "mergedRepositories" | "totalRepositories">): string {
  return `${row.mergedRepositories} of ${countLabel(row.totalRepositories, "repository", "repositories")} merged`;
}
