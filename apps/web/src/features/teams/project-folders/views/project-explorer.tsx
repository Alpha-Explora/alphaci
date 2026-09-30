"use client";

import "./project-folders.css";

import type { ReactNode } from "react";

import { createRepositoryHref, moveTargets } from "../model/project-folder-rules";
import {
  useCreateProjectFolderViewModel,
  type CreateProjectFolderViewModel,
} from "../view-models/use-create-project-folder-view-model";
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
import { CloseIcon } from "./project-folder-icons";
import { ProjectFolderList } from "./project-folder-list";

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
 * It draws no head of its own: the Projects page's heading carries the count
 * and the create actions (Create project, and the "⋯" menu with Empty project
 * and Add repository), fed by ProjectExplorerHost. `create` is the Empty
 * project dialog, owned by the host so the menu and the empty state's
 * "Create the first Project" open the same one.
 */
export function ProjectExplorer({
  vm,
  create,
}: Readonly<{ vm: ProjectFoldersViewModel; create: CreateProjectFolderViewModel }>) {
  const move = useMoveRepositoryViewModel({ onChanged: vm.reload });
  const del = useDeleteProjectViewModel({ onDeleted: vm.closeFolder, onChanged: vm.reload });
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
        <ProjectFolderList vm={vm} onCreate={create.openDialog} />
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

/** The create actions the page heading offers, already filtered by role. */
export interface ProjectExplorerActions {
  /**
   * Opens the Empty project dialog; null when the caller may not create one
   * (the server's `canManage`, known once the list has loaded).
   */
  createEmptyProject: (() => void) | null;
  /** The create-repository wizard for this team; null below Team lead. */
  addRepositoryHref: string | null;
}

export interface ProjectExplorerSlot {
  /** Projects in the team, or null while loading — the heading's count. */
  count: number | null;
  /** The explorer itself: the Project cards, or one Project opened in place. */
  panel: ReactNode;
  actions: ProjectExplorerActions;
}

/**
 * Loads a team's Projects once and hands the caller the count, the create
 * actions and the explorer panel. A render prop, so the Projects page can put
 * the count and the actions in its own heading without wiring the view-models
 * by hand.
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
  /** Open this Project's detail on arrival (a `/workflows?project=` link). */
  initialFolderId?: string | null;
  children: (explorer: ProjectExplorerSlot) => ReactNode;
}>) {
  const vm = useProjectFoldersViewModel({ groupId, groupName, qaChecklistsEnabled, initialFolderId });
  const create = useCreateProjectFolderViewModel({ groupId: vm.groupId, onCreated: vm.reload });
  const actions: ProjectExplorerActions = {
    createEmptyProject: vm.canManage && vm.status === "ready" ? create.openDialog : null,
    addRepositoryHref: vm.canCreateRepository ? createRepositoryHref(vm.groupId) : null,
  };
  return (
    <>
      {children({
        count: vm.count,
        panel: <ProjectExplorer vm={vm} create={create} />,
        actions,
      })}
    </>
  );
}
