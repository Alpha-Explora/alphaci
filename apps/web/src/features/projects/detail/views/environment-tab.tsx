"use client";

import type { ProvisionedProject } from "@/features/projects";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { EnvMetadataList } from "./env-metadata-list";
import { ProjectEnvPanel } from "./project-env-panel";

export function EnvironmentTab({
  project,
  vm,
}: Readonly<{
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
  dangerZone?: React.ReactNode;
}>) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <EnvironmentBody project={project} vm={vm} />
    </div>
  );
}

function EnvironmentBody({
  project,
  vm,
}: Readonly<{
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
}>) {
  if (vm.envProvisioningEnabled && project.status === "provisioned") {
    return <ProjectEnvPanel project={project} section="variables" />;
  }
  return <EnvMetadataList metadata={vm.envMetadata} />;
}
