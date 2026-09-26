"use client";

import Link from "next/link";
import { useState } from "react";

import { qaStudioHref } from "@/features/checklists";
import { projectStatusVariant } from "@/features/groups";

import {
  attachableChecklists,
  checklistAttachment,
  createRepositoryHref,
  folderChecklists,
  folderProjectIds,
  repositoryCountLabel,
  verifyProjectId,
} from "../model/project-folder-rules";
import type {
  FolderChecklist,
  FolderRepository,
  ProjectFolder,
} from "../model/project-folder-types";
import {
  useFolderChecklistsViewModel,
  type FolderChecklistsViewModel,
} from "../view-models/use-folder-checklists-view-model";
import type { ProjectFoldersViewModel } from "../view-models/use-project-folders-view-model";
import { BackIcon, ChecklistIcon, PlusIcon, StudioIcon } from "./project-folder-icons";
import { RepoChip } from "./repo-chip";

function DetailActions({
  vm,
  folder,
}: Readonly<{ vm: ProjectFoldersViewModel; folder: ProjectFolder }>) {
  const verifyId = vm.canVerifyInQaStudio ? verifyProjectId(folder) : null;
  if (!verifyId && !vm.canCreateRepository) return null;
  return (
    <div className="pf-detail__actions">
      {verifyId ? (
        <Link className="ghost-button" href={qaStudioHref(verifyId)}>
          <StudioIcon />
          Verify in QA Studio
        </Link>
      ) : null}
      {vm.canCreateRepository ? (
        <Link
          className="primary-button"
          href={createRepositoryHref(vm.groupId, folder.deliveryProjectId)}
        >
          <PlusIcon />
          Create repository in this Project
        </Link>
      ) : null}
    </div>
  );
}

function RepositoryRow({
  repo,
  canMove,
  onMove,
}: Readonly<{ repo: FolderRepository; canMove: boolean; onMove: () => void }>) {
  return (
    <li className="pf-repo">
      <div className="pf-repo__main">
        <RepoChip
          name={repo.name}
          repoFullName={repo.repoFullName}
          role={repo.project?.role ?? null}
          projectId={repo.project?.id ?? null}
        />
        {repo.repoFullName ? <code className="pf-repo__full">{repo.repoFullName}</code> : null}
      </div>
      <div className="pf-repo__aside">
        {repo.project ? (
          <span className={`project-status-badge ${projectStatusVariant(repo.project.status)}`}>
            {repo.project.status}
          </span>
        ) : (
          <span className="pf-repo__unlinked">No AlphaCI project</span>
        )}
        {canMove ? (
          <button
            type="button"
            className="ghost-button"
            onClick={onMove}
            aria-label={`Move ${repo.name} to another Project`}
          >
            Move
          </button>
        ) : null}
      </div>
    </li>
  );
}

function EmptyRepositories({
  vm,
  folder,
}: Readonly<{ vm: ProjectFoldersViewModel; folder: ProjectFolder }>) {
  return (
    <div className="pf-empty-folder">
      <p>
        No repositories in this Project yet.
        {vm.canCreateRepository ? " Create the first one and it lands here." : ""}
      </p>
      {vm.canCreateRepository ? (
        <Link
          className="primary-button"
          href={createRepositoryHref(vm.groupId, folder.deliveryProjectId)}
        >
          <PlusIcon />
          Create repository in this Project
        </Link>
      ) : null}
    </div>
  );
}

const ATTACHMENT_LABELS = {
  attached: "All repositories",
  partial: "Some repositories",
  none: "Not attached",
} as const;

function ChecklistRow({
  folder,
  checklist,
  canManage,
  checklistsVm,
}: Readonly<{
  folder: ProjectFolder;
  checklist: FolderChecklist;
  canManage: boolean;
  checklistsVm: FolderChecklistsViewModel;
}>) {
  const attachment = checklistAttachment(folder, checklist);
  const busy = checklistsVm.pendingId === checklist.id;
  return (
    <li className="pf-checklist">
      <span className="pf-checklist__icon">
        <ChecklistIcon />
      </span>
      <span className="pf-checklist__text">
        <span className="pf-checklist__name">{checklist.name}</span>
        <span className="pf-checklist__meta">
          {checklist.itemCount} {checklist.itemCount === 1 ? "item" : "items"}
          <span className={`pf-pill pf-pill--${attachment}`}>{ATTACHMENT_LABELS[attachment]}</span>
        </span>
      </span>
      {canManage ? (
        <span className="pf-checklist__actions">
          {attachment === "partial" ? (
            <button
              type="button"
              className="ghost-button"
              disabled={checklistsVm.status === "saving"}
              onClick={() => void checklistsVm.attach(checklist)}
            >
              Attach to all
            </button>
          ) : null}
          <button
            type="button"
            className="ghost-button"
            disabled={checklistsVm.status === "saving"}
            onClick={() => void checklistsVm.detach(checklist)}
            aria-label={`Detach ${checklist.name} from this Project`}
          >
            {busy ? "Saving…" : "Detach"}
          </button>
        </span>
      ) : null}
    </li>
  );
}

function AttachChecklist({
  folder,
  checklists,
  checklistsVm,
}: Readonly<{
  folder: ProjectFolder;
  checklists: FolderChecklist[];
  checklistsVm: FolderChecklistsViewModel;
}>) {
  const [choice, setChoice] = useState("");
  const options = attachableChecklists(folder, checklists).filter(
    (checklist) => checklistAttachment(folder, checklist) === "none",
  );
  if (options.length === 0) return null;
  const picked = options.find((checklist) => checklist.id === choice) ?? null;
  return (
    <form
      className="pf-attach"
      onSubmit={(event) => {
        event.preventDefault();
        if (picked) void checklistsVm.attach(picked).then(() => setChoice(""));
      }}
    >
      <label className="pf-attach__field">
        <span className="hier-field-label">Attach a checklist template</span>
        <select
          className="hier-select"
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
        >
          <option value="">Choose a checklist…</option>
          {options.map((checklist) => (
            <option key={checklist.id} value={checklist.id}>
              {checklist.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="primary-button"
        disabled={!picked || checklistsVm.status === "saving"}
      >
        Attach to this Project
      </button>
    </form>
  );
}

function ChecklistsBody({
  vm,
  folder,
  checklists,
}: Readonly<{
  vm: ProjectFoldersViewModel;
  folder: ProjectFolder;
  checklists: FolderChecklist[];
}>) {
  const checklistsVm = useFolderChecklistsViewModel({ folder, onSaved: vm.applyChecklist });
  const attached = folderChecklists(folder, checklists);
  const canAttach = vm.canManage && folderProjectIds(folder).length > 0;
  return (
    <>
      {attached.length > 0 ? (
        <ul className="pf-checklists">
          {attached.map((checklist) => (
            <ChecklistRow
              key={checklist.id}
              folder={folder}
              checklist={checklist}
              canManage={vm.canManage}
              checklistsVm={checklistsVm}
            />
          ))}
        </ul>
      ) : (
        <p className="pf-note">No checklist is attached to this Project.</p>
      )}
      {canAttach ? (
        <AttachChecklist folder={folder} checklists={checklists} checklistsVm={checklistsVm} />
      ) : null}
      {checklistsVm.error ? (
        <p className="error-text pf-inline-error" role="alert">
          {checklistsVm.error}
        </p>
      ) : null}
    </>
  );
}

function FolderChecklistsSection({
  vm,
  folder,
}: Readonly<{ vm: ProjectFoldersViewModel; folder: ProjectFolder }>) {
  if (!vm.qaChecklistsEnabled) return null;
  let body: React.ReactNode;
  if (!vm.checklists) {
    body = <p className="pf-note">Loading checklists…</p>;
  } else if (folderProjectIds(folder).length === 0) {
    body = (
      <p className="pf-note">
        Checklists attach to a Project&apos;s repositories. Add a repository first.
      </p>
    );
  } else {
    body = <ChecklistsBody vm={vm} folder={folder} checklists={vm.checklists} />;
  }
  return (
    <section className="pf-detail__block" aria-labelledby="pf-checklists-title">
      <h4 className="pf-subhead" id="pf-checklists-title">
        Checklists
      </h4>
      {body}
    </section>
  );
}

/** One Project: its repositories, what verifies it, and its checklists. */
export function ProjectFolderDetail({
  vm,
  folder,
  onMove,
}: Readonly<{
  vm: ProjectFoldersViewModel;
  folder: ProjectFolder;
  onMove: (repository: FolderRepository) => void;
}>) {
  const canMove = vm.canManage && vm.folders.length > 1;
  return (
    <div className="pf-detail">
      <div className="group-section-head pf-detail__head">
        <button type="button" className="pf-back" onClick={vm.closeFolder}>
          <BackIcon />
          All Projects
        </button>
      </div>
      <div className="pf-detail__title-row">
        <div>
          <h3 className="pf-detail__title">{folder.name}</h3>
          <p className="pf-detail__meta">
            {vm.groupName} · {repositoryCountLabel(folder.repositories.length)}
          </p>
        </div>
        <DetailActions vm={vm} folder={folder} />
      </div>

      <section className="pf-detail__block" aria-labelledby="pf-repos-title">
        <h4 className="pf-subhead" id="pf-repos-title">
          Repositories
        </h4>
        {folder.repositories.length === 0 ? (
          <EmptyRepositories vm={vm} folder={folder} />
        ) : (
          <ul className="pf-repos">
            {folder.repositories.map((repo) => (
              <RepositoryRow
                key={repo.repositoryId}
                repo={repo}
                canMove={canMove}
                onMove={() => onMove(repo)}
              />
            ))}
          </ul>
        )}
      </section>

      <FolderChecklistsSection vm={vm} folder={folder} />
    </div>
  );
}
