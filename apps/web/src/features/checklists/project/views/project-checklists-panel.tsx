"use client";

import "./project-checklists.css";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { LoadingRows } from "@/features/groups/workspace";

import { ChecklistItemList } from "../../items";
import type { QaChecklist } from "../../model/checklist-types";
import { REPOSITORY_SCOPE, type QaScope } from "../../model/qa-scope";
import {
  automatedItemCount,
  checklistManageHref,
  itemCountLabel,
} from "../../model/checklist-rules";
import {
  useProjectChecklistsViewModel,
  type ProjectChecklistsViewModel,
} from "../view-models/use-project-checklists-view-model";

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

function ChecklistCard({
  checklist,
  manageHref,
}: Readonly<{ checklist: QaChecklist; manageHref: string | null }>) {
  const automated = automatedItemCount(checklist.items);
  return (
    <section className="qa-project-card" aria-labelledby={`qa-card-${checklist.id}`}>
      <header className="qa-project-card__head">
        <div className="qa-project-card__titles">
          <h3 className="qa-project-card__title" id={`qa-card-${checklist.id}`}>
            {checklist.name}
          </h3>
          <p className="qa-project-card__meta">
            <span>{itemCountLabel(checklist.items.length)}</span>
            {automated > 0 ? <span>{automated} automated</span> : null}
            <span>Version {checklist.version}</span>
          </p>
        </div>
        {manageHref ? (
          <Link className="ghost-button qa-project-card__manage" href={manageHref}>
            Manage in team
          </Link>
        ) : null}
      </header>
      {checklist.description ? (
        <p className="qa-project-card__desc">{checklist.description}</p>
      ) : null}
      <ChecklistItemList items={checklist.items} />
    </section>
  );
}

function PanelState({
  vm,
  workspaceHref,
  inProject,
}: Readonly<{ vm: ProjectChecklistsViewModel; workspaceHref: string | null; inProject: boolean }>) {
  if (vm.status === "loading") return <LoadingRows rows={2} />;
  if (vm.status === "error") {
    return (
      <div className="hier-state" role="alert">
        <h3 className="hier-state-title">Checklists did not load</h3>
        <p className="hier-state-text">{vm.error}</p>
        <button type="button" className="ghost-button qa-project-card__manage" onClick={vm.reload}>
          Try again
        </button>
      </div>
    );
  }
  if (inProject) {
    return (
      <div className="hier-state">
        <h3 className="hier-state-title">No requirements yet</h3>
        <p className="hier-state-text">When the Product owner adds Features or System requirements to the Project, they appear here.</p>
      </div>
    );
  }
  return (
    <div className="hier-state">
      <h3 className="hier-state-title">No checklists shared to this project</h3>
      <p className="hier-state-text">
        {vm.canManage
          ? "Write a checklist for the team, then share it here so developers and QA see what this project has to pass."
          : "When a team lead shares a QA checklist to this project, its checks appear here."}
      </p>
      {vm.canManage && workspaceHref ? (
        <Link className="primary-button qa-project-card__manage" href={workspaceHref}>
          Open team checklists
        </Link>
      ) : null}
    </div>
  );
}

/**
 * For a repository filed under a Project: its requirements live on the
 * Project now, edited there by the Product owner; this tab only lists them.
 */
function ProjectPointer({ scope }: Readonly<{ scope: QaScope }>) {
  if (scope.kind !== "project") return null;
  return (
    <div className="qa-project-pointer">
      <p>
        Requirements belong to the Project <strong>{scope.projectName}</strong> and apply to every repository in it.
        Product owners write them, Developers move their Progress and the QA Team verifies them there.
      </p>
      {scope.projectHref ? (
        <Link className="primary-button qa-project-card__manage" href={scope.projectHref}>
          Open the Project&apos;s requirements
        </Link>
      ) : null}
    </div>
  );
}

/**
 * The project's Checklists tab: every checklist shared to this project, with
 * its items in order. Read-only for everyone — checklists are written at the
 * team — so leads get a way to the team page instead of an editor here.
 */
export function ProjectChecklistsPanel({
  projectId,
  workspaceId,
  qaScope = REPOSITORY_SCOPE,
  myItems = null,
}: Readonly<{
  projectId: string;
  /** The owning team. Null for a project outside any team: no manage link then. */
  workspaceId: string | null;
  /** A repository in a Project points at the Project's requirements instead of team templates. */
  qaScope?: QaScope;
  /** The viewer's "My QA items" list, when this tab carries it (shown above the checklists). */
  myItems?: ReactNode;
}>) {
  const inProject = qaScope.kind === "project";
  const vm = useProjectChecklistsViewModel({ projectId, enabled: Boolean(projectId) });
  const reduced = useReducedMotion();
  const workspaceHref = workspaceId ? checklistManageHref(workspaceId) : null;
  const ready = vm.status === "ready" && vm.checklists.length > 0;

  return (
    <div
      role="tabpanel"
      id="project-detail-panel-checklists"
      aria-labelledby="project-detail-tab-checklists"
      className="qa-project-panel"
    >
      <p className="qa-project-panel__lede">
        {inProject
          ? "The requirements of this repository's Project, read-only here."
          : "QA checklists your team shared to this project. Each item says who runs it and how it is verified."}
      </p>
      <ProjectPointer scope={qaScope} />
      {myItems}
      {ready ? (
        <div className="qa-project-panel__cards">
          {vm.checklists.map((checklist, index) => (
            <motion.div
              key={checklist.id}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: EASE_OUT, delay: Math.min(index, 4) * 0.05 }}
            >
              <ChecklistCard
                checklist={checklist}
                manageHref={
                  vm.canManage && workspaceId && !inProject
                    ? checklistManageHref(workspaceId, checklist.id)
                    : null
                }
              />
            </motion.div>
          ))}
        </div>
      ) : (
        <PanelState vm={vm} workspaceHref={workspaceHref} inProject={inProject} />
      )}
    </div>
  );
}
