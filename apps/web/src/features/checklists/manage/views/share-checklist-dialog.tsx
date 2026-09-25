"use client";

import { FormDialog } from "@/features/groups/workspace";

import type { ChecklistShareTarget, QaChecklist } from "../../model/checklist-types";
import type { ShareChecklistViewModel } from "../view-models/use-share-checklist-view-model";

function selectionSummary(selected: number, total: number): string {
  if (selected === 0) return "Not shared to any project";
  if (selected === total) return `All ${total} projects`;
  return `${selected} of ${total} projects`;
}

/**
 * Pick the projects in this team that show the checklist. Only this team's
 * repositories are offered: a checklist cannot cross the team it belongs to.
 */
export function ShareChecklistDialog({
  checklist,
  projects,
  vm,
}: Readonly<{
  checklist: QaChecklist;
  projects: ReadonlyArray<ChecklistShareTarget>;
  vm: ShareChecklistViewModel;
}>) {
  const allIds = projects.map((project) => project.id);
  const allSelected = projects.length > 0 && vm.selectedIds.length === projects.length;
  return (
    <FormDialog
      open={vm.open}
      onClose={vm.closeDialog}
      title={`Share “${checklist.name}”`}
      description="Shared checklists appear on each project's Checklists tab for its developers and QA."
      submitLabel="Save sharing"
      submitting={vm.status === "loading"}
      error={vm.error}
      canSubmit={vm.dirty}
      onSubmit={() => void vm.submit()}
    >
      {projects.length === 0 ? (
        <p className="qa-share__empty">
          This team has no repositories yet. Create one first, then come back to
          share the checklist to it.
        </p>
      ) : (
        <fieldset className="qa-share">
          <legend className="qa-share__legend">
            <span>{selectionSummary(vm.selectedIds.length, projects.length)}</span>
            <button
              type="button"
              className="inline-link qa-link-button"
              onClick={() => vm.setAll(allSelected ? [] : allIds)}
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </legend>
          <ul className="qa-share__list">
            {projects.map((project) => {
              const checked = vm.selectedIds.includes(project.id);
              return (
                <li key={project.id}>
                  <label className={`qa-share__row${checked ? " qa-share__row--on" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => vm.toggle(project.id)}
                    />
                    <span className="qa-share__text">
                      <span className="qa-share__name">{project.name}</span>
                      {project.detail ? (
                        <span className="qa-share__detail">{project.detail}</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
    </FormDialog>
  );
}
