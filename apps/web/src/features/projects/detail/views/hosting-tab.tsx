"use client";

import { BranchPreviewsPanel } from "@/features/projects/previews";
import { ProjectDomainsPanel } from "@/features/projects/domains";
import type { DeploymentTarget, ProvisionedProject } from "@/features/projects";
import { providerDisplayName } from "../model/provider-urls";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { DeploymentHistoryList } from "./deployment-history-list";
import { DeploymentTargetsList } from "./deployment-targets-list";
import { EnvironmentOperationsPanel } from "./environment-operations-panel";
import { ProjectEnvPanel } from "./project-env-panel";

export function HostingTab({
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
      <EnvironmentOperationsPanel
        projectId={project.id}
        targets={vm.deploymentTargets}
      />
      <HostingProvisionPrompt
        envEnabled={vm.envProvisioningEnabled}
        hasTargets={vm.deploymentTargets.length > 0}
        onTargetCreated={vm.handleTargetCreated}
        project={project}
      />
      <HostingPreviews
        enabled={vm.previewDeploymentsEnabled}
        projectId={project.id}
      />
      <HostingHistory
        enabled={
          vm.deploymentHistoryEnabled &&
          vm.overview?.capabilities.deploymentHistory === true
        }
        error={vm.deploymentsError}
        response={vm.deployments}
      />
      <DeploymentTargetsList
        logFocus={vm.logFocus}
        managementEnabled={vm.projectTargetManagementEnabled}
        onDetached={vm.handleTargetDetached}
        onTargetChanged={vm.handleTargetChanged}
        projectId={project.id}
        targets={vm.deploymentTargets}
      />
      <HostingDomains
        enabled={vm.envProvisioningEnabled}
        projectId={project.id}
        targets={vm.deploymentTargets}
      />
    </div>
  );
}

function HostingProvisionPrompt({
  envEnabled,
  hasTargets,
  onTargetCreated,
  project,
}: Readonly<{
  envEnabled: boolean;
  hasTargets: boolean;
  onTargetCreated: ProjectDetailTabsViewModel["handleTargetCreated"];
  project: ProvisionedProject;
}>) {
  if (envEnabled && project.status === "provisioned" && !hasTargets) {
    return (
      <ProjectEnvPanel
        onTargetCreated={onTargetCreated}
        project={project}
        section="hosting"
      />
    );
  }
  if (!envEnabled && !hasTargets) {
    return (
      <p className="env-empty-state">
        Hosting service provisioning is not enabled.
      </p>
    );
  }
  return null;
}

function HostingPreviews({
  enabled,
  projectId,
}: Readonly<{ enabled: boolean; projectId: string }>) {
  if (!enabled) return null;
  return (
    <section aria-labelledby="hosting-previews-heading">
      <h4 className="ws-reported__head" id="hosting-previews-heading">
        Branch previews
      </h4>
      <BranchPreviewsPanel enabled projectId={projectId} />
    </section>
  );
}

function HostingHistory({
  enabled,
  error,
  response,
}: Readonly<{
  enabled: boolean;
  error: string | null;
  response: ProjectDetailTabsViewModel["deployments"];
}>) {
  if (!enabled) {
    return (
      <p className="env-empty-state">Deployment history is not enabled.</p>
    );
  }
  if (error) {
    return (
      <p className="error-text" style={{ margin: 0 }}>
        {error}
      </p>
    );
  }
  return <DeploymentHistoryList response={response} />;
}

function HostingDomains({
  enabled,
  projectId,
  targets,
}: Readonly<{
  enabled: boolean;
  projectId: string;
  targets: DeploymentTarget[];
}>) {
  if (!enabled) return null;
  return (
    <section aria-labelledby="hosting-domains-heading">
      <h4 className="ws-reported__head" id="hosting-domains-heading">
        Custom domains
      </h4>
      <ProjectDomainsPanel
        enabled
        projectId={projectId}
        targets={targets.map(domainTargetOption)}
      />
    </section>
  );
}

function domainTargetOption(target: DeploymentTarget): {
  id: string;
  label: string;
} {
  return {
    id: target.id,
    label: `${providerDisplayName(target.provider)} · ${target.providerProjectName}`,
  };
}
