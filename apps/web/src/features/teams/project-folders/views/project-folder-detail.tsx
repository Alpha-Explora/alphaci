"use client";

import Link from "next/link";
import { useId } from "react";

import { ProjectQaWorkspace } from "@/features/checklists/requirements";
import { projectStatusVariant } from "@/features/groups";

import {
  FEATURES_REQUIRED_NOTE,
  createRepositoryHref,
  emptyRepositoriesCopy,
  folderFeatureGate,
  repositoryCountLabel,
  studioLinkFor,
  verifyProjectId,
  type FolderFeatureGate,
} from "../model/project-folder-rules";
import type { FolderRepository, ProjectFolder } from "../model/project-folder-types";
import type { ProjectFoldersViewModel } from "../view-models/use-project-folders-view-model";
import { AddRepositoryAction, FeatureNudge, FeaturesRequiredNote } from "./feature-gate";
import { BackIcon, StudioIcon } from "./project-folder-icons";
import { RepoChip } from "./repo-chip";

/**
 * The viewer's studio (Verify in QA Studio for the QA Team and admins, Open
 * PO Studio for a Product owner) and Add repository
 * (Developer, admin): a Product owner creates the Project, a Developer fills
 * it, once the Project has its first Feature.
 */
function DetailActions({
  vm,
  folder,
  gate,
  noteId,
}: Readonly<{ vm: ProjectFoldersViewModel; folder: ProjectFolder; gate: FolderFeatureGate; noteId: string }>) {
  const verifyId = vm.canVerifyInQaStudio ? verifyProjectId(folder) : null;
  const studio = verifyId ? studioLinkFor(vm.appRole, verifyId) : null;
  if (!studio && gate.addRepository === "hidden") return null;
  return (
    <div className="pf-detail__actions">
      {studio ? (
        <Link className="ghost-button" href={studio.href}>
          <StudioIcon />
          {studio.label}
        </Link>
      ) : null}
      <AddRepositoryAction
        state={gate.addRepository}
        href={createRepositoryHref(vm.groupId, folder.deliveryProjectId)}
        className="primary-button"
        noteId={noteId}
      />
    </div>
  );
}

/** Under the title: why a Developer waits, or the Product owner's nudge. */
function FeatureGateBanner({
  vm,
  folder,
  gate,
  noteId,
}: Readonly<{ vm: ProjectFoldersViewModel; folder: ProjectFolder; gate: FolderFeatureGate; noteId: string }>) {
  if (gate.addRepository === "blocked") return <FeaturesRequiredNote id={noteId} className="pf-gate-note pf-gate-note--banner" />;
  if (!gate.featureNudge) return null;
  return (
    <FeatureNudge
      projectName={folder.name}
      onAddFeature={() => vm.requestNewFeature(folder.deliveryProjectId)}
      className="pf-nudge pf-nudge--banner"
    />
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
  gate,
}: Readonly<{ vm: ProjectFoldersViewModel; folder: ProjectFolder; gate: FolderFeatureGate }>) {
  const noteId = useId();
  const blocked = gate.addRepository === "blocked";
  return (
    <div className="pf-empty-folder">
      <p id={noteId}>{blocked ? FEATURES_REQUIRED_NOTE : emptyRepositoriesCopy(vm.canCreateRepository)}</p>
      <AddRepositoryAction
        state={gate.addRepository}
        href={createRepositoryHref(vm.groupId, folder.deliveryProjectId)}
        className="primary-button"
        noteId={noteId}
      />
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
        newFeatureRequest={
          vm.newFeatureRequest?.deliveryProjectId === folder.deliveryProjectId ? vm.newFeatureRequest.nonce : 0
        }
        onFeatureCount={(count) => vm.noteFeatureCount(folder.deliveryProjectId, count)}
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
  const gate = folderFeatureGate(folder, vm);
  const noteId = useId();
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
        <DetailActions vm={vm} folder={folder} gate={gate} noteId={noteId} />
      </div>
      <FeatureGateBanner vm={vm} folder={folder} gate={gate} noteId={noteId} />

      <section className="pf-detail__block" aria-labelledby="pf-repos-title">
        <h4 className="pf-subhead" id="pf-repos-title">
          Repositories
        </h4>
        {folder.repositories.length === 0 ? (
          <EmptyRepositories vm={vm} folder={folder} gate={gate} />
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
