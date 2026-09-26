/* QA run types. Pure: no React, no fetch, no Next.
 *
 * A QA run is one checklist, verified against one commit of one branch. The
 * wire shapes mirror the backend contract exactly; the server resolves the
 * commit, decides every permission and owns each item's rowVersion, so the
 * client never sends a sha and never guesses a right. */

import type {
  ChecklistTargetPersona,
  ChecklistVerificationType,
} from "./checklist-types";
import type { QaAutomatedResultWire, QaRunAutomationWire } from "./qa-automation-types";

export type QaRunItemStatus =
  | "pending"
  | "in_progress"
  | "passed"
  | "failed"
  | "blocked"
  | "returned_to_dev";

export type QaDefectSeverity = "blocker" | "major" | "minor";

export type QaVerdict = "APPROVED" | "REJECTED" | "CONDITIONAL";

export type QaCommitSource = "deployment" | "branch_head";

export type QaRunStatus = "open" | "signed_off";

export interface QaActor {
  id: string;
  login: string;
}

export interface QaFixRequest {
  requestedAt: string;
  requestedBy: QaActor;
  note: string | null;
}

/** Where this item stood on the previous run of the same checklist and branch. */
export interface QaPreviousResult {
  runId: string;
  commitSha: string;
  status: QaRunItemStatus;
}

export interface QaRunItem {
  id: string;
  runId: string;
  position: number;
  title: string;
  description: string | null;
  targetPersona: ChecklistTargetPersona;
  verificationType: ChecklistVerificationType;
  testIdentifier: string | null;
  status: QaRunItemStatus;
  notes: string | null;
  defectSeverity: QaDefectSeverity | null;
  reproductionSteps: string | null;
  fixRequest: QaFixRequest | null;
  verifiedBy: QaActor | null;
  verifiedAt: string | null;
  /** Echoed back on every write so two testers cannot overwrite each other. */
  rowVersion: number;
  /** Server-decided for this viewer and this item's persona. */
  canUpdate: boolean;
  previous: QaPreviousResult | null;
  /**
   * What CI reported for this item on this run's commit. Null for manual
   * items; ABSENT from older backends and older frozen reports. Read it only
   * through `normalizeAutomatedResult`. Never changes `status`.
   */
  automated?: QaAutomatedResultWire | null;
}

export interface QaSignoff {
  id: string;
  verdict: QaVerdict;
  summary: string | null;
  conditions: string | null;
  signedBy: QaActor;
  signedAt: string;
}

export interface QaRunSummaryCounts {
  total: number;
  byStatus: Record<QaRunItemStatus, number>;
  openDefects: number;
  blockers: number;
}

export interface QaRunPermissions {
  canUpdateItems: boolean;
  canReturnToDev: boolean;
  canRequestRetest: boolean;
  canSignOff: boolean;
  canReopen: boolean;
}

export interface QaRunListItem {
  id: string;
  projectId: string;
  /** Null once the checklist was deleted with its workspace; checklistName/Version stay. */
  checklistId: string | null;
  checklistName: string;
  checklistVersion: number;
  branch: string;
  commitSha: string;
  commitSource: QaCommitSource;
  status: QaRunStatus;
  createdBy: QaActor;
  createdAt: string;
  updatedAt: string;
  summary: QaRunSummaryCounts;
  signoff: QaSignoff | null;
}

export interface QaRun extends QaRunListItem {
  items: QaRunItem[];
  permissions: QaRunPermissions;
  /**
   * Per-stage CI results for this run's exact branch and commit. ABSENT from
   * older backends. Read it only through `normalizeRunAutomation`.
   */
  automation?: QaRunAutomationWire | null;
}

export interface QaRunListResponse {
  items: QaRunListItem[];
}

/** The commit the branch resolves to now, and the run against it if one exists. */
export interface QaCurrentRunResponse {
  commitSha: string | null;
  commitSource: QaCommitSource | null;
  run: QaRun | null;
}

export interface QaReturnedItem {
  runId: string;
  branch: string;
  commitSha: string;
  checklistName: string;
  item: QaRunItem;
}

export interface QaReturnedItemsResponse {
  items: QaReturnedItem[];
}

/**
 * An item the current uat run assigns to developers, where the viewer can see
 * and — when `item.canUpdate` says so — record its result.
 */
export type QaDeveloperItem = QaReturnedItem;

/**
 * GET /projects/:id/qa-my-items. Read it only through `normalizeMyQaItems`:
 * an older backend may send neither list, or not have the route at all.
 */
export interface QaMyItemsResponse {
  returned: QaReturnedItem[];
  developerItems: QaDeveloperItem[];
}

export interface CreateQaRunInput {
  checklistId: string;
  branch: string;
}

export interface UpdateQaRunItemInput {
  expectedRowVersion: number;
  status?: QaRunItemStatus;
  notes?: string | null;
  defectSeverity?: QaDefectSeverity | null;
  reproductionSteps?: string | null;
}

export interface QaSignoffInput {
  verdict: QaVerdict;
  summary?: string;
  conditions?: string;
}

/** What a tester is typing into one item before it is saved. */
export interface QaItemDraft {
  status: QaRunItemStatus;
  notes: string;
  defectSeverity: QaDefectSeverity | "";
  reproductionSteps: string;
}

/** A failed write, turned into something a view can show. */
export interface QaActionError {
  message: string;
  /** True when the run changed under the viewer: offer "Reload run". */
  stale: boolean;
}
