"use client";

import type { ProjectQaRunItem } from "../../model/project-run-types";
import { evidenceAlt } from "../../model/qa-attachment-rules";
import type { ReportEvidenceItem, ReportEvidenceViewModel } from "../view-models/use-report-evidence-view-model";

const KIND_LABELS = { evidence: "QA evidence", fix_proof: "Proof of fix", automated: "Playwright" } as const;

function Figure({
  entry,
  index,
  item,
  vm,
}: Readonly<{ entry: ReportEvidenceItem; index: number; item: ProjectQaRunItem; vm: ReportEvidenceViewModel }>) {
  const alt = evidenceAlt(entry.ref, index, item.title);
  const url = entry.attachment?.url ?? null;
  const settle = () => {
    if (entry.attachment) vm.imageSettled(entry.attachment.id);
  };
  return (
    <figure className="qa-report-evidence__figure">
      {url ? (
        // A signed, short-lived URL: eager, so the print dialog never waits on a lazy image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} loading="eager" onLoad={settle} onError={settle} />
      ) : (
        <span className="qa-report-evidence__missing">
          {vm.status === "loading" ? "Loading the screenshot…" : "The screenshot could not be loaded."}
        </span>
      )}
      <figcaption>
        <span className="qa-report-evidence__kind">{KIND_LABELS[entry.ref.kind]}</span>
        {entry.ref.caption ?? `Screenshot ${String(index + 1)}`}
      </figcaption>
    </figure>
  );
}

/**
 * The screenshots under one item of the printed Project report, as the run
 * was signed with them (the report's frozen ids). Nothing for an item without
 * any; the "Visual evidence" appendix is separate and unchanged.
 */
export function ReportItemEvidence({ item, vm }: Readonly<{ item: ProjectQaRunItem; vm: ReportEvidenceViewModel }>) {
  if (item.attachments.length === 0) return null;
  const entries = vm.forItem(item.attachments);
  return (
    <div className="qa-report-evidence" aria-label={`Evidence for ${item.title}`} role="group">
      {entries.map((entry, index) => (
        <Figure key={entry.ref.id} entry={entry} index={index} item={item} vm={vm} />
      ))}
    </div>
  );
}
