"use client";

import { useAttachmentGroupViewModel, type AttachmentGroupViewModel, type CaptureOption } from "../../evidence";
import type { ProjectQaRunItem } from "../../model/project-run-types";
import { evidenceCountFromRun } from "../../model/qa-attachment-rules";
import type { PreviewCaptureTarget } from "./preview-capture-target";
import { useRememberedFlag } from "./use-remembered-flag";
import type { RunEvidenceViewModel } from "./use-run-evidence-view-model";

/**
 * `hidden`: nothing to show and nothing this viewer may add (or the server
 * has no screenshots); `single`: QA evidence only, drawn exactly as before
 * fix proofs existed; `grouped`: the item also holds a Developer's proof of
 * the fix, so the two kinds sit in labelled groups.
 */
export type ItemEvidenceStatus = "hidden" | "single" | "grouped";

export interface ItemEvidenceViewModel {
  status: ItemEvidenceStatus;
  /** QA's evidence: Capture, Paste and Upload add here, and only here. */
  qa: AttachmentGroupViewModel;
  /** The Developer's proof of the fix: read-only in QA Studio (delete where the server allows). */
  fix: AttachmentGroupViewModel;
  /** Both groups: the section's badge. */
  count: number;
}

const HINT_KEY = "alphaci.qa.evidence.capture-hint-seen";

function itemEvidenceStatus(
  evidence: Pick<RunEvidenceViewModel, "status">,
  qa: AttachmentGroupViewModel,
  fix: AttachmentGroupViewModel,
): ItemEvidenceStatus {
  if (evidence.status === "hidden") return "hidden";
  if (fix.count > 0) return "grouped";
  const anything = qa.canAdd || qa.atLimit || qa.count > 0 || qa.draft !== null;
  return anything ? "single" : "hidden";
}

/**
 * ViewModel for one QA Studio item's Evidence: QA's own group (Capture the
 * preview, Paste, Upload, all as `evidence`) and, beside it once there is
 * any, the Developer's proof of the fix. Both read the run's one list.
 */
export function useItemEvidenceViewModel(options: {
  item: ProjectQaRunItem;
  evidence: RunEvidenceViewModel;
  captureTarget: PreviewCaptureTarget | null;
}): ItemEvidenceViewModel {
  const { item, evidence, captureTarget } = options;
  const [hintSeen, toggleHintSeen] = useRememberedFlag(HINT_KEY, false);
  const capture: CaptureOption | null = captureTarget
    ? { target: captureTarget, hintSeen, markHintSeen: toggleHintSeen }
    : null;
  const qa = useAttachmentGroupViewModel({
    itemId: item.id,
    group: "evidence",
    source: evidence,
    countFromRun: evidenceCountFromRun(item),
    mayAdd: evidence.canAdd,
    capture,
  });
  const fix = useAttachmentGroupViewModel({
    itemId: item.id,
    group: "fix_proof",
    source: evidence,
    countFromRun: item.fixProofCount,
    mayAdd: false,
    capture: null,
  });
  return { status: itemEvidenceStatus(evidence, qa, fix), qa, fix, count: qa.count + fix.count };
}
