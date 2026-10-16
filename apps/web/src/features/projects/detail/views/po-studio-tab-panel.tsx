"use client";

import type { ReactNode } from "react";

import type { QaScope } from "@/features/checklists";
import { QaStudioPanel } from "@/features/checklists/studio";
import type { ProvisionedProject } from "@/features/projects";

import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { studioChecksRenderer } from "./studio-repository-checks";

/**
 * The PO Studio tab: QA Studio's shell in its Product owner mode. The studio
 * belongs to the checklists domain; this file only adapts the project page's
 * panel contract to it. QA's results show read-only in the studio's own rail.
 */
export function PoStudioTabPanel({
  project,
  vm,
  qaScope,
  studioToolbarSlot,
}: Readonly<{
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
  dangerZone?: ReactNode;
  qaScope?: QaScope;
  /** The tab row's slot for the studio's preview controls (see ProjectDetailTabs). */
  studioToolbarSlot?: HTMLElement | null;
}>) {
  return (
    <QaStudioPanel
      projectId={project.id}
      appRole={vm.appRole}
      projectName={project.repoFullName}
      qaScope={qaScope}
      toolbarSlot={studioToolbarSlot}
      renderRepositoryChecks={studioChecksRenderer(project.id, vm)}
      studio="po"
    />
  );
}
