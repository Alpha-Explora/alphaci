"use client";

import type { ReactNode } from "react";

import { ProjectChecklistsPanel } from "@/features/checklists/project";
import type { ProvisionedProject } from "@/features/projects";

/**
 * The Checklists tab. Checklists belong to the checklists domain; this file
 * only adapts the project page's panel contract to it.
 */
export function ChecklistsTabPanel({
  project,
}: Readonly<{
  project: ProvisionedProject;
  vm?: unknown;
  dangerZone?: ReactNode;
}>) {
  return (
    <ProjectChecklistsPanel
      projectId={project.id}
      workspaceId={project.workspaceId ?? null}
    />
  );
}
