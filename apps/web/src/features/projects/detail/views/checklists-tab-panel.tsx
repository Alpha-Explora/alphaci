"use client";

import type { ReactNode } from "react";

import { checklistsTabShowsMyItems, REPOSITORY_SCOPE, type QaScope } from "@/features/checklists";
import { ProjectChecklistsPanel } from "@/features/checklists/project";
import { MyQaItemsCard } from "@/features/checklists/returned";
import type { ProvisionedProject } from "@/features/projects";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";

/**
 * The Checklists tab. Checklists belong to the checklists domain; this file
 * only adapts the project page's panel contract to it.
 *
 * A repository with no Project to send the viewer to also carries its full
 * "My QA items" list here (what QA returned, with "Mark fixed & request
 * re-test", and the current run's developer items): the Overview shows only a
 * summary of it, and its "Open checklist" lands on this tab. A repository in a
 * Project works from the Project's "My QA items" instead (unless the server
 * has no Project-wide list, when the per-repository card stands in here).
 */
export function ChecklistsTabPanel({
  project,
  vm,
  qaScope = REPOSITORY_SCOPE,
}: Readonly<{
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
  dangerZone?: ReactNode;
  qaScope?: QaScope;
}>) {
  return (
    <ProjectChecklistsPanel
      projectId={project.id}
      workspaceId={project.workspaceId ?? null}
      qaScope={qaScope}
      myItems={
        <MyQaItemsCard
          appRole={vm.appRole}
          enabled={vm.qaChecklistsEnabled && Boolean(vm.appRole)}
          projectId={project.id}
          qaScope={qaScope}
          projectListElsewhere={!checklistsTabShowsMyItems(qaScope)}
        />
      }
    />
  );
}
