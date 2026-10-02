"use client";

import type { ReactNode } from "react";

import type { QaScope } from "@/features/checklists";
import { QaStudioPanel } from "@/features/checklists/studio";
import type { ProvisionedProject } from "@/features/projects";

import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";

/**
 * The PO Studio tab: QA Studio's shell in its Product owner mode. The studio
 * belongs to the checklists domain; this file only adapts the project page's
 * panel contract to it. "View the QA run" opens the Checklists tab, where the
 * Project's QA run is.
 */
export function PoStudioTabPanel({
  project,
  vm,
  qaScope,
}: Readonly<{
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
  dangerZone?: ReactNode;
  qaScope?: QaScope;
}>) {
  return (
    <QaStudioPanel
      projectId={project.id}
      appRole={vm.appRole}
      projectName={project.repoFullName}
      qaScope={qaScope}
      studio="po"
      onOpenQaRun={() => vm.setTab("checklists")}
    />
  );
}
