"use client";

import {
  EvidenceCount,
  EvidenceGroupBody,
  evidencePasteHandler,
  ImageIcon,
  WrenchIcon,
  type AttachmentGroupViewModel,
} from "../../evidence";
import type { ProjectQaRunItem } from "../../model/project-run-types";
import { usePreviewCaptureTarget } from "../view-models/preview-capture-target";
import { useItemEvidenceViewModel, type ItemEvidenceViewModel } from "../view-models/use-item-evidence-view-model";
import type { RunEvidenceViewModel } from "../view-models/use-run-evidence-view-model";

/** The read error of the run's whole list, shown once per item that has screenshots. */
function ListError({ evidence, count }: Readonly<{ evidence: RunEvidenceViewModel; count: number }>) {
  if (evidence.status !== "error" || count === 0) return null;
  return (
    <div className="qa-inline-alert" role="alert">
      <p>{evidence.error}</p>
      <button type="button" className="ghost-button" onClick={evidence.reload}>
        Try again
      </button>
    </div>
  );
}

/** One labelled group ("QA evidence", "Fix proof"), shown once the item holds a fix proof. */
function Group({
  label,
  vm,
  item,
}: Readonly<{ label: string; vm: AttachmentGroupViewModel; item: ProjectQaRunItem }>) {
  return (
    <div className="qa-evidence__group" role="group" aria-label={label} data-group={vm.group}>
      <span className="qa-evidence__group-label">
        {vm.group === "fix_proof" ? <WrenchIcon /> : null}
        {label}
        <EvidenceCount count={vm.count} />
      </span>
      <EvidenceGroupBody vm={vm} itemTitle={item.title} />
    </div>
  );
}

function Groups({
  vm,
  item,
  evidence,
}: Readonly<{ vm: ItemEvidenceViewModel; item: ProjectQaRunItem; evidence: RunEvidenceViewModel }>) {
  const listError = <ListError evidence={evidence} count={vm.count} />;
  if (vm.status !== "grouped") return <EvidenceGroupBody vm={vm.qa} itemTitle={item.title} listError={listError} />;
  return (
    <>
      {listError}
      <div className="qa-evidence__groups">
        <Group label="QA evidence" vm={vm.qa} item={item} />
        <Group label="Fix proof" vm={vm.fix} item={item} />
      </div>
    </>
  );
}

/**
 * One item's Evidence: its screenshots as thumbnails (click to enlarge), and
 * — for whoever the server lets add while the run is open — Capture (the QA
 * Studio preview), Paste and Upload, always as QA evidence. Once a Developer
 * attached proof of the fix, the two kinds sit in labelled groups, side by
 * side where there is room. Hidden on a server without screenshots, and when
 * there is nothing to show and nothing this viewer may add.
 */
export function ItemEvidence({ item, evidence }: Readonly<{ item: ProjectQaRunItem; evidence: RunEvidenceViewModel }>) {
  const captureTarget = usePreviewCaptureTarget();
  const vm = useItemEvidenceViewModel({ item, evidence, captureTarget });
  if (vm.status === "hidden") return null;
  const canPaste = vm.qa.canAdd;
  return (
    <section
      className="qa-evidence"
      aria-label={`Evidence for ${item.title}`}
      tabIndex={canPaste ? 0 : undefined}
      onPaste={canPaste ? evidencePasteHandler(vm.qa) : undefined}
    >
      <div className="qa-evidence__head">
        <span className="qa-evidence__label">
          <ImageIcon />
          Evidence
        </span>
        <EvidenceCount count={vm.count} />
        {evidence.open ? null : <span className="qa-evidence__frozen">Frozen at sign-off</span>}
      </div>
      <Groups vm={vm} item={item} evidence={evidence} />
    </section>
  );
}
