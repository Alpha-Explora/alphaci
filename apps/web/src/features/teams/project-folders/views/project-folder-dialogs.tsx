"use client";

import { FormDialog } from "@/features/groups/workspace";

import { PROJECT_NAME_MAX, repositoryCountLabel } from "../model/project-folder-rules";
import type { ProjectFolder } from "../model/project-folder-types";
import type { CreateProjectFolderViewModel } from "../view-models/use-create-project-folder-view-model";
import type { MoveRepositoryViewModel } from "../view-models/use-move-repository-view-model";

/** New Project: an empty Project in this team, filled by creating or moving repositories. */
export function NewProjectDialog({
  vm,
  teamName,
}: Readonly<{ vm: CreateProjectFolderViewModel; teamName: string }>) {
  return (
    <FormDialog
      open={vm.open}
      onClose={vm.closeDialog}
      title="New Project"
      description={`A Project groups the repositories in ${teamName} that ship together. It starts empty.`}
      submitLabel="Create Project"
      submitting={vm.status === "saving"}
      error={vm.error}
      canSubmit={vm.canSubmit}
      onSubmit={() => void vm.submit()}
    >
      <label className="hier-field">
        <span className="hier-field-label">Name</span>
        <input
          className="hier-input"
          value={vm.name}
          maxLength={PROJECT_NAME_MAX}
          placeholder="checkout"
          onChange={(event) => vm.setName(event.target.value)}
        />
      </label>
      <label className="hier-field">
        <span className="hier-field-label">Description</span>
        <textarea
          className="hier-textarea"
          rows={2}
          value={vm.description}
          placeholder="What it delivers (optional)"
          onChange={(event) => vm.setDescription(event.target.value)}
        />
      </label>
    </FormDialog>
  );
}

/** Move one repository to another Project of the same team. */
export function MoveRepositoryDialog({
  vm,
  targets,
}: Readonly<{ vm: MoveRepositoryViewModel; targets: ReadonlyArray<ProjectFolder> }>) {
  const repository = vm.repository;
  return (
    <FormDialog
      open={repository !== null}
      onClose={vm.close}
      title={repository ? `Move ${repository.name}` : "Move repository"}
      description={
        vm.source
          ? `It leaves ${vm.source.name}. Its dashboard, pipeline and history stay as they are.`
          : undefined
      }
      submitLabel="Move repository"
      submitting={vm.status === "saving"}
      error={vm.error}
      canSubmit={vm.targetId !== ""}
      onSubmit={() => void vm.submit(targets)}
    >
      {targets.length === 0 ? (
        <p className="pf-note">This team has no other Project. Create one first.</p>
      ) : (
        <fieldset className="pf-targets">
          <legend className="hier-field-label">Move to</legend>
          {targets.map((folder) => (
            <label
              key={folder.deliveryProjectId}
              className={`pf-target${vm.targetId === folder.deliveryProjectId ? " pf-target--on" : ""}`}
            >
              <input
                type="radio"
                name="pf-move-target"
                value={folder.deliveryProjectId}
                checked={vm.targetId === folder.deliveryProjectId}
                onChange={() => vm.setTargetId(folder.deliveryProjectId)}
              />
              <span className="pf-target__text">
                <span className="pf-target__name">{folder.name}</span>
                <span className="pf-target__meta">{repositoryCountLabel(folder.repositories.length)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </FormDialog>
  );
}
