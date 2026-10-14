"use client";

import { EvidenceCount, EvidenceGroupBody, evidencePasteHandler, WrenchIcon } from "../../evidence";
import type { ProjectQaRunItem } from "../../model/project-run-types";
import { useFixProofViewModel, type FixProofViewModel } from "../view-models/use-fix-proof-view-model";

const LEDE = "Screenshots that show the fix. They reach QA at once, and QA sees them beside its own evidence.";

function ListError({ vm }: Readonly<{ vm: FixProofViewModel }>) {
  if (vm.status !== "error") return null;
  return (
    <div className="qa-inline-alert" role="alert">
      <p>{vm.error}</p>
      <button type="button" className="ghost-button" onClick={vm.reload}>
        Try again
      </button>
    </div>
  );
}

/**
 * A Developer's "Proof of the fix" on a My QA items entry: the item's fix
 * screenshots (click to enlarge, Delete where the server allows) and, while
 * the server says proof may be attached, Paste and Upload with an optional
 * caption. The caller shows it only where `showsFixProof` says so.
 */
export function FixProof({
  deliveryProjectId,
  runId,
  runItem,
  onStale,
}: Readonly<{ deliveryProjectId: string; runId: string; runItem: ProjectQaRunItem; onStale?: () => void }>) {
  const vm = useFixProofViewModel({ deliveryProjectId, runId, runItem, onStale });
  const group = vm.group;
  return (
    <section
      className="qa-evidence qa-fix-proof"
      data-group="fix_proof"
      aria-label={`Proof of the fix for ${runItem.title}`}
      tabIndex={group.canAdd ? 0 : undefined}
      onPaste={group.canAdd ? evidencePasteHandler(group) : undefined}
    >
      <div className="qa-evidence__head">
        <span className="qa-evidence__label">
          <WrenchIcon />
          Proof of the fix
        </span>
        <EvidenceCount count={group.count} />
      </div>
      {group.canAdd && group.count === 0 && !group.draft ? <p className="qa-evidence__hint">{LEDE}</p> : null}
      <EvidenceGroupBody vm={group} itemTitle={runItem.title} listError={<ListError vm={vm} />} />
    </section>
  );
}
