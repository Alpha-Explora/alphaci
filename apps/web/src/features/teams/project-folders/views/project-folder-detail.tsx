"use client";

import Link from "next/link";

import { qaStudioHref } from "@/features/checklists";
import { ProjectQaWorkspace } from "@/features/checklists/requirements";
import { projectStatusVariant } from "@/features/groups";

import {
  createRepositoryHref,
  emptyRepositoriesCopy,
  repositoryCountLabel,
  verifyProjectId,
} from "../model/project-folder-rules";
import type { FolderRepository, ProjectFolder } from "../model/project-folder-types";
import type { ProjectFoldersViewModel } from "../view-models/use-project-folders-view-model";
import { BackIcon, PlusIcon, StudioIcon } from "./project-folder-icons";
import { RepoChip } from "./repo-chip";

/**
 * Verify in QA Studio (QA Team, Product owner, admin) and Add repository
 * (Developer, admin): a Product owner creates the Project, a Developer fills it.
 */
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
          Add repository
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
      <p>{emptyRepositoriesCopy(vm.canCreateRepository)}</p>
      {vm.canCreateRepository ? (
        <Link
          className="primary-button"
          href={createRepositoryHref(vm.groupId, folder.deliveryProjectId)}
        >
          <PlusIcon />
          Add repository
        </Link>
      ) : null}
    </div>
  );
}

/**
 * The Project's requirements, its QA run and its project-wide QA items. The
 * workspace belongs to the checklists domain and owns its view-models.
 */
function ProjectQaSection({
  vm,
  folder,
}: Readonly<{ vm: ProjectFoldersViewModel; folder: ProjectFolder }>) {
  if (!vm.qaChecklistsEnabled) return null;
  return (
    <section className="pf-detail__block" aria-labelledby="pf-qa-title">
      <h4 className="pf-subhead" id="pf-qa-title">
        Requirements and QA
      </h4>
      <ProjectQaWorkspace
        deliveryProjectId={folder.deliveryProjectId}
        projectName={folder.name}
        appRole={vm.appRole}
      />
    </section>
  );
}

function ProjectFolderDangerZone({
  folder,
  onDelete,
}: Readonly<{ folder: ProjectFolder; onDelete: () => void }>) {
  return (
    <section className="pf-detail__block pf-danger" aria-labelledby="pf-danger-title">
      <h4 className="pf-subhead" id="pf-danger-title">
        Danger zone
      </h4>
      <div className="pf-danger__row">
        <p className="pf-note">
          Delete {folder.name} and every repository inside it. This cannot be undone.
        </p>
        <button type="button" className="pf-delete-submit" onClick={onDelete}>
          Delete Project
        </button>
      </div>
    </section>
  );
}

/** One Project: its repositories, its requirements and QA, and (for leads) Delete. */
export function ProjectFolderDetail({
  vm,
  folder,
  onMove,
  onDelete,
}: Readonly<{
  vm: ProjectFoldersViewModel;
  folder: ProjectFolder;
  onMove: (repository: FolderRepository) => void;
  onDelete: () => void;
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

      <ProjectQaSection vm={vm} folder={folder} />

      {vm.canManage ? <ProjectFolderDangerZone folder={folder} onDelete={onDelete} /> : null}
    </div>
  );
}
