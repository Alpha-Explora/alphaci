"use client";

import type { ReactNode } from "react";
import type { ProvisionedProject } from "@/features/projects";
import { configuredOrNot } from "../model/project-detail-tab-rules";

export function SettingsTab({
  project,
  dangerZone,
}: Readonly<{
  project: ProvisionedProject;
  vm?: unknown;
  dangerZone?: ReactNode;
}>) {
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
