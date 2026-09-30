"use client";

import "./project-folders.css";

import Link from "next/link";
import type { ReactNode } from "react";

import { createRepositoryHref, moveTargets } from "../model/project-folder-rules";
import { useCreateProjectFolderViewModel } from "../view-models/use-create-project-folder-view-model";
import {
  useDeleteProjectViewModel,
  type DeleteProjectViewModel,
} from "../view-models/use-delete-project-view-model";
import {
  useMoveRepositoryViewModel,
  type MoveRepositoryViewModel,
} from "../view-models/use-move-repository-view-model";
import {
  useProjectFoldersViewModel,
  type ProjectFoldersViewModel,
} from "../view-models/use-project-folders-view-model";
import { DeleteProjectDialog, MoveRepositoryDialog, NewProjectDialog } from "./project-folder-dialogs";
import { ProjectFolderDetail } from "./project-folder-detail";
import { CloseIcon, PlusIcon } from "./project-folder-icons";
import { ProjectFolderList } from "./project-folder-list";

function ListHead({
  vm,
  onCreate,
}: Readonly<{ vm: ProjectFoldersViewModel; onCreate: () => void }>) {
  return (
    <div className="group-section-head">
      <h3 className="group-section-title">
        Projects
        {vm.count === null ? null : <span className="group-section-count">{vm.count}</span>}
      </h3>
      <div className="pf-head-actions">
        {vm.canCreateRepository ? (
          <Link className="ghost-button group-section-action" href={createRepositoryHref(vm.groupId)}>
            Create repository
          </Link>
        ) : null}
        {vm.canManage && vm.status === "ready" ? (
          <button type="button" className="primary-button group-section-action" onClick={onCreate}>
            <PlusIcon />
            New Project
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DeleteNoticeBanner({ del }: Readonly<{ del: DeleteProjectViewModel }>) {
  if (!del.notice) return null;
  return (
    <div className="pf-notice" role="status">
      <p className="pf-notice__text">{del.notice}</p>
      <button
        type="button"
        className="pf-notice__close"
        aria-label="Dismiss"
        onClick={del.dismissNotice}
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function MoveNoticeBanner({
  move,
  canManage,
}: Readonly<{ move: MoveRepositoryViewModel; canManage: boolean }>) {
  const notice = move.notice;
  if (!notice) return null;
  return (
    <div className="pf-notice" role="status">
      <p className="pf-notice__text">
        {notice.text}
        {notice.emptied ? ` ${notice.emptied.name} has no repositories now.` : ""}
      </p>
      {notice.emptied && canManage ? (
        <button
          type="button"
          className="ghost-button"
          disabled={move.status === "archiving"}
          onClick={() => void move.archiveEmptied()}
        >
          {move.status === "archiving" ? "Archiving…" : `Archive ${notice.emptied.name}`}
        </button>
      ) : null}
      <button
        type="button"
        className="pf-notice__close"
        aria-label="Dismiss"
        onClick={move.dismissNotice}
      >
        <CloseIcon />
      </button>
    </div>
  );
}

/**
 * A team's Projects: the list, or one Project opened in place.
 *
 * Draws its own section head (like the checklist templates beside it) because
 * its action — New Project — depends on the server's `canManage`, which only
 * this section loads.
 */
export function ProjectExplorer({ vm }: Readonly<{ vm: ProjectFoldersViewModel }>) {
  const move = useMoveRepositoryViewModel({ onChanged: vm.reload });
  const del = useDeleteProjectViewModel({ onDeleted: vm.closeFolder, onChanged: vm.reload });
  const create = useCreateProjectFolderViewModel({ groupId: vm.groupId, onCreated: vm.reload });
  const folder = vm.selected;

  return (
    <div className="pf-section">
      <MoveNoticeBanner move={move} canManage={vm.canManage} />
      <DeleteNoticeBanner del={del} />
      {folder ? (
        <ProjectFolderDetail
          vm={vm}
          folder={folder}
          onMove={(repo) => move.openFor(repo, folder)}
          onDelete={() => del.openFor(folder)}
        />
      ) : (
        <>
          <ListHead vm={vm} onCreate={create.openDialog} />
          <ProjectFolderList vm={vm} onCreate={create.openDialog} />
        </>
      )}
      {vm.status === "ready" && vm.error ? (
        <p className="error-text pf-inline-error" role="alert">
          {vm.error}
        </p>
      ) : null}
      <NewProjectDialog vm={create} teamName={vm.groupName} />
      <MoveRepositoryDialog
        vm={move}
        targets={move.source ? moveTargets(vm.folders, move.source.deliveryProjectId) : []}
      />
      <DeleteProjectDialog vm={del} />
    </div>
  );
}

export interface ProjectExplorerSlot {
  /** Projects in the team, or null while loading — the rail badge. */
  count: number | null;
  /** The section body to draw when the rail's Projects entry is open. */
  panel: ReactNode;
}

/**
 * Loads a team's Projects once and hands the caller both the count (for the
 * section rail) and the explorer panel. A render prop, so the Teams page and
 * the Workflows studio mount the same explorer without either one wiring the
 * view-model by hand.
 */
export function ProjectExplorerHost({
  groupId,
  groupName,
  qaChecklistsEnabled,
  initialFolderId,
  children,
}: Readonly<{
  groupId: string;
  groupName: string;
  qaChecklistsEnabled: boolean;
  /** Open this Project's detail on arrival (a `/teams?project=` link). */
  initialFolderId?: string | null;
  children: (explorer: ProjectExplorerSlot) => ReactNode;
}>) {
  const vm = useProjectFoldersViewModel({ groupId, groupName, qaChecklistsEnabled, initialFolderId });
  return <>{children({ count: vm.count, panel: <ProjectExplorer vm={vm} /> })}</>;
}
