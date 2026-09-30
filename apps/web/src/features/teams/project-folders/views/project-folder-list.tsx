"use client";

import Link from "next/link";

import { LoadingRows } from "@/features/groups/workspace";

import {
  checklistCountLabel,
  folderChecklists,
  folderLandingProjectId,
  projectDashboardHref,
  repositoryCountLabel,
} from "../model/project-folder-rules";
import type {
  FolderChecklist,
  ProjectFolder,
  UnfiledProject,
} from "../model/project-folder-types";
import type { ProjectFoldersViewModel } from "../view-models/use-project-folders-view-model";
import {
  ChecklistIcon,
  ChevronIcon,
  FolderIcon,
  InboxIcon,
  PlusIcon,
  SlidersIcon,
} from "./project-folder-icons";
import { RepoChip } from "./repo-chip";

function FolderMeta({
  folder,
  checklists,
}: Readonly<{ folder: ProjectFolder; checklists: FolderChecklist[] | null }>) {
  const count = checklists ? folderChecklists(folder, checklists).length : null;
  return (
    <span className="pf-card__meta">
      <span>{repositoryCountLabel(folder.repositories.length)}</span>
      {count === null ? null : (
        <span className={`pf-card__checklists${count === 0 ? " pf-card__checklists--none" : ""}`}>
          <ChecklistIcon />
          {checklistCountLabel(count)}
        </span>
      )}
    </span>
  );
}

/**
 * One Project. The card itself opens the Project as one product — its
 * frontend's page, which carries a switch to the other repositories — and
 * "Manage" (a sibling control, never nested inside the card's link) opens the
 * Project's detail: repositories, Move, checklists and Delete Project. A
 * Project with no linked repository has no page to open, so its card opens
 * the detail as it always did.
 */
function FolderCard({
  folder,
  checklists,
  onOpen,
}: Readonly<{
  folder: ProjectFolder;
  checklists: FolderChecklist[] | null;
  onOpen: () => void;
}>) {
  const landingId = folderLandingProjectId(folder);
  const face = (
    <>
      <span className="pf-card__icon">
        <FolderIcon />
      </span>
      <span className="pf-card__text">
        <span className="pf-card__name">{folder.name}</span>
        <FolderMeta folder={folder} checklists={checklists} />
      </span>
      <span className="pf-card__chevron">
        <ChevronIcon />
      </span>
    </>
  );
  return (
    <li className="pf-card">
      <div className="pf-card__head">
        {landingId ? (
          <Link className="pf-card__open" href={projectDashboardHref(landingId)}>
            {face}
          </Link>
        ) : (
          <button type="button" className="pf-card__open" onClick={onOpen}>
            {face}
          </button>
        )}
        <button
          type="button"
          className="pf-card__manage"
          aria-label={`Manage ${folder.name}`}
          onClick={onOpen}
        >
          <SlidersIcon />
          <span className="pf-card__manage-label">Manage</span>
        </button>
      </div>
      {folder.repositories.length > 0 ? (
        <ul className="pf-chips" aria-label={`Repositories in ${folder.name}`}>
          {folder.repositories.map((repo) => (
            <li key={repo.repositoryId}>
              <RepoChip
                name={repo.name}
                repoFullName={repo.repoFullName}
                role={repo.project?.role ?? null}
                projectId={repo.project?.id ?? null}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="pf-card__empty">No repositories yet.</p>
      )}
    </li>
  );
}

function UnfiledGroup({ unfiled }: Readonly<{ unfiled: UnfiledProject[] }>) {
  if (unfiled.length === 0) return null;
  return (
    <section className="pf-unfiled" aria-labelledby="pf-unfiled-title">
      <h4 className="pf-subhead" id="pf-unfiled-title">
        <InboxIcon size={14} />
        Unfiled
        <span className="group-section-count">{unfiled.length}</span>
      </h4>
      <p className="pf-unfiled__lede">
        Repositories that are not in a Project yet. They work as before.
      </p>
      <ul className="pf-chips">
        {unfiled.map((project) => (
          <li key={project.id}>
            <RepoChip
              name={project.name}
              repoFullName={project.repoFullName}
              role={project.role}
              projectId={project.id}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ExplorerError({
  message,
  onRetry,
}: Readonly<{ message: string; onRetry: () => void }>) {
  return (
    <div className="hier-state" role="alert">
      <h4 className="hier-state-title">Projects did not load</h4>
      <p className="hier-state-text">{message}</p>
      <button type="button" className="ghost-button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function EmptyExplorer({
  canManage,
  onCreate,
}: Readonly<{ canManage: boolean; onCreate: () => void }>) {
  return (
    <div className="hier-state">
      <span className="hier-state-icon" aria-hidden="true">
        <FolderIcon size={20} />
      </span>
      <h4 className="hier-state-title">No Projects yet</h4>
      <p className="hier-state-text">
        A Project groups the repositories that ship together, such as a
        frontend and its backend.
        {canManage ? "" : " A Team lead creates them."}
      </p>
      {canManage ? (
        <button type="button" className="primary-button" onClick={onCreate}>
          <PlusIcon />
          Create the first Project
        </button>
      ) : null}
    </div>
  );
}

/** The explorer's list screen: every Project, then anything unfiled. */
export function ProjectFolderList({
  vm,
  onCreate,
}: Readonly<{ vm: ProjectFoldersViewModel; onCreate: () => void }>) {
  if (vm.status === "loading") return <LoadingRows rows={3} />;
  if (vm.status === "error") {
    return <ExplorerError message={vm.error ?? ""} onRetry={vm.reload} />;
  }
  if (vm.folders.length === 0 && vm.unfiled.length === 0) {
    return <EmptyExplorer canManage={vm.canManage} onCreate={onCreate} />;
  }
  return (
    <div className="pf-list-screen">
      {vm.folders.length > 0 ? (
        <ul className="pf-list">
          {vm.folders.map((folder) => (
            <FolderCard
              key={folder.deliveryProjectId}
              folder={folder}
              checklists={vm.checklists}
              onOpen={() => vm.openFolder(folder.deliveryProjectId)}
            />
          ))}
        </ul>
      ) : (
        <p className="pf-note">No Projects yet. Everything below is unfiled.</p>
      )}
      <UnfiledGroup unfiled={vm.unfiled} />
    </div>
  );
}
