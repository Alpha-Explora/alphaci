"use client";

import type { ReactNode } from "react";

import { checklistsTabShowsMyItems, REPOSITORY_SCOPE, type QaScope } from "@/features/checklists";
import { ProjectChecklistsPanel } from "@/features/checklists/project";
import { ProjectQaWorkspace } from "@/features/checklists/requirements";
import { MyQaItemsCard } from "@/features/checklists/returned";
import type { ProvisionedProject } from "@/features/projects";
import { checklistsTabCarriesProjectQa } from "../model/project-detail-tab-rules";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";

/**
 * The Checklists tab. Checklists belong to the checklists domain; this file
 * only adapts the project page's panel contract to it.
 *
 * For a repository filed under a Project this tab IS the Project's QA
 * workspace — Requirements, QA run and My QA items — for every role (Developer,
 * Admin, Product owner, QA Team): the Overview's "Open checklist" lands on it,
 * on "My QA items". On a server with no Project-wide list the per-repository
 * card stands in on that tab. The wrapper keeps the tabpanel the strip's
 * `aria-controls` names.
 *
 * A repository with no Project (or one the page could not read, as on an
 * older backend) keeps the per-repository screens and carries its full "My QA
 * items" list here (what QA returned, with "Mark fixed & request re-test", and
 * the current run's developer items).
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
  if (qaScope.kind === "project" && checklistsTabCarriesProjectQa(qaScope.kind)) {
    return (
      <div
        role="tabpanel"
        id="project-detail-panel-checklists"
        aria-labelledby="project-detail-tab-checklists"
        className="qa-project-panel"
      >
        <ProjectQaWorkspace
          deliveryProjectId={qaScope.deliveryProjectId}
          projectName={qaScope.projectName}
          appRole={vm.appRole}
          enabled={vm.qaChecklistsEnabled}
          onOpenHistory={vm.visibleTabs.includes("history") ? () => vm.setTab("history") : undefined}
          itemsFallback={
            <MyQaItemsCard
              appRole={vm.appRole}
              enabled={vm.qaChecklistsEnabled && Boolean(vm.appRole)}
              projectId={project.id}
            />
          }
        />
      </div>
    );
  }
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
