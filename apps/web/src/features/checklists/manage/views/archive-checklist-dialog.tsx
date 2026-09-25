"use client";

import { FormDialog } from "@/features/groups/workspace";

import type { QaChecklist } from "../../model/checklist-types";
import { sharedCountLabel } from "../../model/checklist-rules";
import type { ArchiveChecklistViewModel } from "../view-models/use-archive-checklist-view-model";

export function ArchiveChecklistDialog({
  checklist,
  vm,
}: Readonly<{ checklist: QaChecklist; vm: ArchiveChecklistViewModel }>) {
  const shared = checklist.sharedProjectIds.length;
  return (
    <FormDialog
      open={vm.open}
      onClose={vm.closeDialog}
      title={`Archive “${checklist.name}”?`}
      description="Archived checklists stop appearing on projects and can no longer be edited. Nothing is deleted — turn on “Show archived” to find it again."
      submitLabel="Archive checklist"
      submitting={vm.status === "loading"}
      error={vm.error}
      onSubmit={() => void vm.confirm()}
    >
      <p className="qa-archive__note">
        {shared > 0
          ? `${sharedCountLabel(shared)} — it disappears from ${shared === 1 ? "that project's" : "those projects'"} Checklists tab.`
          : "It is not shared to any project, so nobody else will notice."}
      </p>
    </FormDialog>
  );
}
