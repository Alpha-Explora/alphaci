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
  const attachments = evidence.forItem(item.id);
  const count = evidenceCount(attachments, item.attachmentCount);
  const [status, setStatus] = useState<ItemEvidenceStatus>("idle");
  const [draft, setDraft] = useDraft();
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [hintSeen, toggleHintSeen] = useRememberedFlag("alphaci.qa.evidence.capture-hint-seen", false);
  const canAdd = evidence.canAdd && !evidenceAtLimit(count);
  const busy = isBusy(status);

  function adopt(image: EvidenceImage, source: EvidenceSource) {
    setDraft({ image, previewUrl: URL.createObjectURL(image.blob), source });
    setStatus("draft");
  }

  function failPreparing(message: string | null) {
    setError(message);
    setStatus(draft ? "draft" : "idle");
  }

  async function prepare(file: Blob, source: EvidenceSource) {
    if (!canAdd || busy) return;
    setStatus("preparing");
    setError(null);
    try {
      adopt(await imageFromFile(file), source);
    } catch (cause) {
      failPreparing(attachmentErrorMessage(cause, PREPARE_ERROR));
    }
  }

  async function capture() {
    const frame = captureTarget?.current;
    if (!frame || !canAdd || busy) return;
    if (!hintSeen) toggleHintSeen();
    setStatus("preparing");
    setError(null);
    try {
      const grab = () => captureElement(frame);
      const hiding = captureTarget?.whileCapturing;
      adopt(await (hiding ? hiding(grab) : grab()), "capture");
    } catch (cause) {
      failPreparing(captureErrorMessage(cause));
    }
  }

  function clearDraft() {
    setDraft(null);
    setCaption("");
    setStatus("idle");
  }

  async function save() {
    if (!draft || status !== "draft") return;
    const invalid = captionError(caption);
    if (invalid) {
      setError(invalid);
      return;
    }
    setStatus("saving");
    setError(null);
    try {
      const saved = await qaAttachmentsRepository.upload(evidence.deliveryProjectId, evidence.runId, item.id, {
        file: draft.image.blob,
        fileName: evidenceFileName(draft.image.type, new Date()),
        caption: captionPayload(caption),
        source: draft.source,
      });
      evidence.added(saved);
      clearDraft();
    } catch (cause) {
      setError(attachmentErrorMessage(cause, SAVE_ERROR));
      setStatus("draft");
      if (RELOAD_CODES.has(errorCode(cause))) evidence.reload();
    }
  }

  async function confirmDelete() {
    const id = confirmingDeleteId;
    if (!id || busy) return;
    setStatus("deleting");
    setError(null);
    try {
      await qaAttachmentsRepository.remove(evidence.deliveryProjectId, evidence.runId, id);
      evidence.removed(id);
      setLightboxIndex(null);
    } catch (cause) {
      setError(attachmentErrorMessage(cause, DELETE_ERROR));
      if (RELOAD_CODES.has(errorCode(cause))) evidence.reload();
    } finally {
      setConfirmingDeleteId(null);
      setStatus(draft ? "draft" : "idle");
    }
  }

  const length = attachments?.length ?? 0;

  return {
    status,
    attachments,
    count,
    canAdd,
    atLimit: evidence.canAdd && evidenceAtLimit(count),
    canCapture: canAdd && captureTarget !== null && supportsScreenCapture(),
    showCaptureHint: !hintSeen,
    draft,
    caption,
    error,
    confirmingDeleteId,
    lightboxIndex: shownIndex(lightboxIndex, length),
    canDelete: (attachment) => canDeleteEvidence(attachment, { status: evidence.open ? "open" : "signed_off" }),
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
