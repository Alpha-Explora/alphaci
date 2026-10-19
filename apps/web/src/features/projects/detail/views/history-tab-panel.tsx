"use client";

import { REPOSITORY_SCOPE, type QaScope } from "@/features/checklists";
import { IterationHistoryPanel } from "@/features/checklists/history";
import type { ProvisionedProject } from "@/features/projects";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";

/**
 * The Release tab: the versions of the Project this repository is filed
 * under, each delivered one read-only, as QA signed it off. Versions belong
 * to a Project, so a repository in no Project (or one whose Project could not
 * be read) says so instead. The history itself is the checklists domain's;
 * this file only adapts the project page's panel contract to it.
 */
export function HistoryTabPanel({
  vm,
  qaScope = REPOSITORY_SCOPE,
}: Readonly<{
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
  qaScope?: QaScope;
}>) {
  return (
    <div
      role="tabpanel"
      id="project-detail-panel-history"
      aria-labelledby="project-detail-tab-history"
      className="qa-project-panel"
    >
      {qaScope.kind === "project" ? (
        <IterationHistoryPanel
          deliveryProjectId={qaScope.deliveryProjectId}
          projectName={qaScope.projectName}
          enabled={vm.qaChecklistsEnabled}
          appRole={vm.appRole}
        />
      ) : (
        <div className="qa-panel-state">
          <h3 className="qa-panel-state__title">No versions here</h3>
          <p className="qa-panel-state__text">
            {qaScope.kind === "pending"
              ? "Reading which Project this repository belongs to…"
              : "Versions belong to a Project. This repository is not filed under one, so it has no release history."}
          </p>
        </div>
      )}
    </div>
  );
}
