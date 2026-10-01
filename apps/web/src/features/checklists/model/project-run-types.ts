/* Project QA run types. Pure: no React, no fetch, no Next.
 *
 * QA verifies once per Project. A Project run captures the uat head of every
 * repository in the Project when it starts and snapshots every requirement's
 * items. Verification (pending / passed / failed / blocked / returned to dev)
 * is recorded on the run item; Progress stays on the requirement item and is
 * echoed onto the run item so QA can see what is Done.
 *
 * The `…Wire` shapes mirror docs/design/project-requirements.md, sections 2.4
 * and 2.5. Views read only the normalised shapes below. */

import type { ChecklistVerificationType } from "./checklist-types";
import type {
  QaActor,
  QaDefectSeverity,
  QaFixRequest,
  QaRunItemStatus,
  QaRunStatus,
  QaRunSummaryCounts,
  QaSignoff,
} from "./qa-run-types";
import type { RequirementItem, RequirementKind, RequirementProgress } from "./requirement-types";

/** Verification never uses `in_progress` on a Project run. */
export type VerificationStatus = Exclude<QaRunItemStatus, "in_progress">;

/* ── Wire shapes ────────────────────────────────────────────────────────── */

export interface HeadStatusWire {
  projectId: string;
  repoFullName: string;
  runSha: string | null;
  currentSha: string | null;
  moved: boolean;
}

export interface ProjectQaRunPermissionsWire {
  canSetVerification: boolean;
  canSignOff: boolean;
  canReopen: boolean;
  canDispatch: boolean;
}

/** GET /delivery-projects/:dpId/qa-runs/current */
export interface ProjectQaRunCurrentWire {
  run: unknown;
  heads: HeadStatusWire[];
  stale: boolean;
  requirementsChanged?: boolean;
}

/** POST /delivery-projects/:dpId/qa-runs (201 created, 200 already there). */
export interface ProjectQaRunCreateWire {
  created: boolean;
  run: unknown;
}

/* ── What the views read (normalised) ───────────────────────────────────── */

export interface HeadStatus {
  projectId: string;
  repoFullName: string;
  /** The uat head the run captured. Null: the repository joined the Project since. */
  runSha: string | null;
  /** uat's head now. Null: it could not be read. */
  currentSha: string | null;
  moved: boolean;
}

export interface ProjectQaRunItem {
  id: string;
  runId: string;
  position: number;
  title: string;
  acceptanceCriteria: string | null;
  requirementId: string | null;
  requirementName: string;
  requirementKind: RequirementKind;
  verificationType: ChecklistVerificationType;
  testIdentifier: string | null;
  status: QaRunItemStatus;
  notes: string | null;
  defectSeverity: QaDefectSeverity | null;
  reproductionSteps: string | null;
  fixRequest: QaFixRequest | null;
  verifiedBy: QaActor | null;
  verifiedAt: string | null;
  /** Null when the server sent none: the item is then read-only. */
  rowVersion: number | null;
  /** The source item's live Progress. Null when unknown (or the item was deleted). */
  progress: RequirementProgress | null;
  /** The requirement item this was snapshotted from; null once it was deleted. */
  sourceItemId: string | null;
  /** The server's per-item answer, or null when it sent none (then the run's flag decides). */
  canUpdate: boolean | null;
}

export interface ProjectQaRunPermissionFlags {
  canSetVerification: boolean | null;
  canSignOff: boolean | null;
  canReopen: boolean | null;
  canDispatch: boolean | null;
}

export interface ProjectQaRunPermissions {
  canSetVerification: boolean;
  canSignOff: boolean;
  canReopen: boolean;
  canDispatch: boolean;
}

export interface ProjectQaRun {
  id: string;
  deliveryProjectId: string;
  deliveryProjectName: string;
  status: QaRunStatus;
  createdBy: QaActor | null;
  createdAt: string | null;
  summary: QaRunSummaryCounts;
  signoff: QaSignoff | null;
  repositories: HeadStatus[];
  /** Any repository moved, or one joined the Project, since the run started. */
  stale: boolean;
  /** Informational: requirements were edited since the run (or its sign-off). */
  requirementsChanged: boolean;
  /** In position order: Features first, then System requirements. */
  items: ProjectQaRunItem[];
  permissions: ProjectQaRunPermissionFlags;
}

export interface ProjectRunCurrent {
  run: ProjectQaRun | null;
  /** Every repository's uat head now, against the run's when there is one. */
  heads: HeadStatus[];
  stale: boolean;
  requirementsChanged: boolean;
}

export interface SetVerificationInput {
  status: VerificationStatus;
  expectedRowVersion: number;
  notes?: string | null;
  defectSeverity?: QaDefectSeverity | null;
  reproductionSteps?: string | null;
}

/** One requirement's run items, as the run panel groups them. */
export interface ProjectRunGroup {
  key: string;
  requirementName: string;
  kind: RequirementKind;
  items: ProjectQaRunItem[];
}

/* ── My QA items (project-wide) ─────────────────────────────────────────── */

export type MyItemsBucket = "returned" | "inProgress" | "todo" | "readyForQa";

export interface ProjectFeedItem {
  requirement: { id: string; name: string; kind: RequirementKind };
  item: RequirementItem;
  runId: string | null;
  runItem: ProjectQaRunItem | null;
}

export type ProjectMyItems = Record<MyItemsBucket, ProjectFeedItem[]>;
