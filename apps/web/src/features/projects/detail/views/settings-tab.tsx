"use client";

import type { ReactNode } from "react";
import type { ProvisionedProject } from "@/features/projects";
import type { AppRole } from "@/shared/api/contracts";
import { configuredOrNot } from "../model/project-detail-tab-rules";
import { ProjectDriftPanel } from "./project-drift-panel";

export function SettingsTab({
  project,
  vm,
  dangerZone,
}: Readonly<{
  project: ProvisionedProject;
  vm?: {
    appRole?: AppRole | null;
    visibleTabs?: ReadonlyArray<string>;
    openPullRequest?: (pullRequestNumber: number) => void;
  };
  dangerZone?: ReactNode;
}>) {
  const openPullRequest = vm?.visibleTabs?.includes("pulls") ? vm.openPullRequest : undefined;
  return (
    <>
      <dl className="project-detail-grid">
        <div>
          <dt>Project ID</dt>
          <dd>{project.id}</dd>
        </div>
        <div>
          <dt>Repository</dt>
          <dd>{project.repoFullName}</dd>
        </div>
        <div>
          <dt>Project type</dt>
          <dd>{configuredOrNot(project.projectTypeId)}</dd>
        </div>
        <div>
          <dt>Workflow recipe</dt>
          <dd>{configuredOrNot(project.workflowRecipeId)}</dd>
        </div>
        <div>
          <dt>Visibility</dt>
          <dd>{configuredOrNot(project.visibility)}</dd>
        </div>
        <div>
          <dt>Repo shape</dt>
          <dd>{configuredOrNot(project.repoShape)}</dd>
        </div>
      </dl>
      <div style={{ marginTop: "1.25rem" }}>
        <ProjectDriftPanel projectId={project.id} appRole={vm?.appRole} onOpenPullRequest={openPullRequest} />
      </div>
      <SettingsDangerZone dangerZone={dangerZone} />
    </>
  );
}

function SettingsDangerZone({
  dangerZone,
}: Readonly<{ dangerZone?: ReactNode }>) {
  if (!dangerZone) return null;
  return <div style={{ marginTop: "1.25rem" }}>{dangerZone}</div>;
}
