"use client";

import type { FormEvent } from "react";

import { Dialog, FormDialog } from "@/features/groups/workspace";

import { PROJECT_NAME_MAX, folderProjectIds, repositoryCountLabel } from "../model/project-folder-rules";
import type { ProjectFolder } from "../model/project-folder-types";
import type { CreateProjectFolderViewModel } from "../view-models/use-create-project-folder-view-model";
import type { DeleteProjectViewModel } from "../view-models/use-delete-project-view-model";
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

function DeleteOptInRow({
  label,
  checked,
  onChange,
}: Readonly<{ label: string; checked: boolean; onChange: (value: boolean) => void }>) {
  return (
    <label className="pf-delete-optin">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

/** Delete a Project and every repository inside it. Irreversible. */
export function DeleteProjectDialog({ vm }: Readonly<{ vm: DeleteProjectViewModel }>) {
  const folder = vm.folder;
  const hasLinkedRepositories = folder ? folderProjectIds(folder).length > 0 : false;
  const submitting = vm.status === "saving";

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!submitting && vm.canSubmit) void vm.submit();
  }

  return (
    <Dialog
      open={folder !== null}
      onClose={vm.close}
      title={folder ? `Delete ${folder.name}?` : "Delete Project"}
      description="This cannot be undone. Every repository inside this Project is removed from ALPHACI."
    >
      {folder ? (
        <form onSubmit={handleSubmit} noValidate>
          {folder.repositories.length > 0 ? (
            <ul className="pf-delete-repos">
              {folder.repositories.map((repo) => (
                <li key={repo.repositoryId} className="pf-delete-repos__row">
                  <span className="pf-delete-repos__name">{repo.name}</span>
                  <span
                    className={`pf-delete-repos__link${repo.project ? "" : " pf-delete-repos__link--none"}`}
                  >
                    {repo.project ? "Linked" : "Not linked"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pf-note">This Project has no repositories.</p>
          )}

          {hasLinkedRepositories ? (
            <fieldset className="pf-delete-optins">
              <legend className="hier-field-label">Also permanently delete</legend>
              <DeleteOptInRow
                label="Also delete the GitHub repositories"
                checked={vm.deleteGithubRepos}
                onChange={vm.setDeleteGithubRepos}
              />
              <DeleteOptInRow
                label="Also delete Render/Vercel deployments"
                checked={vm.deleteProviderResources}
                onChange={vm.setDeleteProviderResources}
              />
              <DeleteOptInRow
                label="Also delete SonarCloud projects"
                checked={vm.deleteSonarProjects}
                onChange={vm.setDeleteSonarProjects}
              />
            </fieldset>
          ) : null}

          <label className="hier-field">
            <span className="hier-field-label">
              Type <strong>{folder.name}</strong> to confirm
            </span>
            <input
              className="hier-input"
              value={vm.confirmName}
              onChange={(event) => vm.setConfirmName(event.target.value)}
              autoComplete="off"
            />
          </label>

          {vm.error ? (
            <p className="error-text pf-inline-error" role="alert">
              {vm.error}
            </p>
          ) : null}

          <div className="hier-dialog-actions">
            <button type="button" className="ghost-button" onClick={vm.close} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="pf-delete-submit" disabled={submitting || !vm.canSubmit}>
              {submitting ? "Deleting…" : "Delete Project"}
            </button>
          </div>
        </form>
      ) : null}
    </Dialog>
  );
}
