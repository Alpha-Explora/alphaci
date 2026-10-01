"use client";

import "./checklist-manage.css";

import type { ReactNode } from "react";

import { LoadingRows } from "@/features/groups/workspace";

import type { ChecklistShareTarget } from "../../model/checklist-types";
import {
  useWorkspaceChecklistsViewModel,
  type WorkspaceChecklistsViewModel,
} from "../view-models/use-workspace-checklists-view-model";
import { BackIcon, PlusIcon } from "./checklist-icons";
import { ChecklistDetail } from "./checklist-detail";
import { ChecklistEditor } from "./checklist-editor";
import { ChecklistList } from "./checklist-list";

/** The list screen's header row: the same shape as every other team section. */
function ListHead({ vm }: Readonly<{ vm: WorkspaceChecklistsViewModel }>) {
  return (
    <div className="group-section-head">
      <h2 className="group-section-title">
        Checklist templates
        {vm.status === "ready" ? (
          <span className="group-section-count">{vm.checklists.length}</span>
        ) : null}
      </h2>
      {vm.canManage && vm.checklists.length > 0 ? (
        <button
          type="button"
          className="primary-button group-section-action"
          onClick={vm.startCreate}
        >
          <PlusIcon />
          New checklist
        </button>
      ) : null}
    </div>
  );
}

/** Any screen below the list gets a way back to it, and nothing else in the head. */
function SubScreen({
  label,
  onBack,
  children,
}: Readonly<{ label: string; onBack: () => void; children: ReactNode }>) {
  return (
    <>
      <div className="group-section-head qa-subscreen-head">
        <button type="button" className="qa-back" onClick={onBack}>
          <BackIcon />
          {label}
        </button>
      </div>
      {children}
    </>
  );
}

function ScreenBody({
  vm,
  workspaceId,
  projects,
}: Readonly<{
  vm: WorkspaceChecklistsViewModel;
  workspaceId: string;
  projects: ReadonlyArray<ChecklistShareTarget>;
}>) {
  const { screen, selected } = vm;
  if (screen.kind === "create") {
    return (
      <SubScreen label="All checklists" onBack={vm.backToList}>
        <ChecklistEditor
          workspaceId={workspaceId}
          checklist={null}
          onSaved={vm.applySaved}
          onCancel={vm.backToList}
          onReload={vm.reload}
        />
      </SubScreen>
    );
  }
  // A view or edit screen whose checklist is still loading.
  if (!selected) return <LoadingRows rows={3} />;
  if (screen.kind === "edit") {
    return (
      <SubScreen label="Back to checklist" onBack={() => vm.openChecklist(selected.id)}>
        <ChecklistEditor
          // Remount on a new version: a reload after a conflict starts a
          // fresh draft from what the other lead saved.
          key={`${selected.id}:${String(selected.version)}`}
          workspaceId={workspaceId}
          checklist={selected}
          onSaved={vm.applySaved}
          onCancel={() => vm.openChecklist(selected.id)}
          onReload={vm.reload}
        />
      </SubScreen>
    );
  }
  return (
    <SubScreen label="All checklists" onBack={vm.backToList}>
      <ChecklistDetail
        checklist={selected}
        projects={projects}
        canManage={vm.canManage}
        now={vm.now}
        onEdit={() => vm.editChecklist(selected.id)}
        onShared={vm.applyShared}
        onArchived={vm.applyArchived}
      />
    </SubScreen>
  );
}

/**
 * The team's QA checklists section: the list, one checklist, or the editor.
 *
 * Owns its own header row (title, count, the one action) because that action
 * — New checklist — depends on the server's `canManage`, which only this
 * section loads. It draws the header with the panel's own classes, so the
 * section reads exactly like Members or Repositories beside it.
 */
export function WorkspaceChecklistsSection({
  workspaceId,
  projects,
  initialChecklistId,
}: Readonly<{
  workspaceId: string;
  /** This team's projects, offered by the Share dialog. */
  projects: ReadonlyArray<ChecklistShareTarget>;
  /** Open straight onto one checklist — used by the project tab's manage link. */
  initialChecklistId?: string | null;
}>) {
  const vm = useWorkspaceChecklistsViewModel({
    workspaceId,
    enabled: Boolean(workspaceId),
    initialChecklistId,
  });

  if (vm.screen.kind !== "list") {
    return (
      <div className="qa-section">
        <ScreenBody vm={vm} workspaceId={workspaceId} projects={projects} />
      </div>
    );
  }

  return (
    <div className="qa-section">
      <ListHead vm={vm} />
      <ChecklistList
        status={vm.status}
        error={vm.error}
        checklists={vm.checklists}
        canManage={vm.canManage}
        now={vm.now}
        showArchived={vm.showArchived}
        onShowArchivedChange={vm.setShowArchived}
        onOpen={vm.openChecklist}
        onRetry={vm.reload}
        onCreate={vm.startCreate}
      />
    </div>
  );
}
