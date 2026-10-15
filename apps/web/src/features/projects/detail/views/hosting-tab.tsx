"use client";

import "./hosting.css";

import { useId } from "react";

import { ProjectDomainsPanel } from "@/features/projects/domains";
import type { DeploymentTarget, EnvVarMetadata, ProvisionedProject } from "@/features/projects";
import {
  environmentScopeBranch,
  hostingEmptyBody,
  type HostingEmptyBody,
  type HostingEnvironmentKind,
} from "../model/hosting-environment-rules";
import {
  canManageEnvVars,
  canManageHosting,
  HOSTING_LEAD_ONLY_NOTE,
} from "../model/project-detail-tab-rules";
import { providerDisplayName } from "../model/provider-urls";
import { useDeploymentTargetsViewModel } from "../view-models/use-deployment-targets-view-model";
import { useEnvVariablesEditor } from "../view-models/use-env-variables-editor-view-model";
import { useHostingTabViewModel } from "../view-models/use-hosting-tab-view-model";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { useProjectEnvProvisioning } from "../view-models/use-project-env-provisioning-view-model";
import { HostingDeploymentCard } from "./hosting-deployment-card";
import { environmentPanelId, environmentTabId, HostingEnvironmentSwitcher } from "./hosting-environment-switcher";
import { HostingServiceHeader, HostingServiceSelector } from "./hosting-service-header";
import { HostingVariablesCard, type ManagedVariables } from "./hosting-variables-card";
import { EnvironmentOperationsPanel } from "./environment-operations-panel";
import { ProjectEnvPanel } from "./project-env-panel";

type TabProps = Readonly<{
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
  dangerZone?: React.ReactNode;
}>;

/**
 * The repository's hosting, one service at a time: the service header, an
 * environment switcher (Production, UAT, Previews), then the selected
 * environment's deployment and, for those who may change them, its variables.
 * Variables used to be a tab of their own (Environment); `#environment` still
 * opens them here. Branch previews stay on the Overview.
 */
export function HostingTab({ project, vm }: TabProps) {
  return (
    <div className="hosting-tab">
      <EnvironmentOperationsPanel
        appRole={vm.appRole}
        onTargetCreated={vm.handleTargetCreated}
        projectId={project.id}
        workspaceId={project.workspaceId??null}
        targets={vm.deploymentTargets}
      />
      <HostingContent project={project} vm={vm} />
    </div>
  );
}

function HostingContent({ project, vm }: TabProps) {
  if (!vm.deploymentTargets.length) return <HostingEmptyState project={project} vm={vm} />;
  if (canManageEnvVars(vm.appRole) && vm.envProvisioningEnabled && project.status === "provisioned") {
    return <ManagedHosting project={project} vm={vm} />;
  }
  return (
    <HostingLayout
      project={project}
      vm={vm}
      metadata={vm.envMetadata}
      managed={null}
      showVariables={canManageEnvVars(vm.appRole)}
    />
  );
}

/** Developers and admins with env provisioning on: the Variables card can write. */
function ManagedHosting({ project, vm }: TabProps) {
  const env = useProjectEnvProvisioning(project.id, true, true);
  const editor = useEnvVariablesEditor(env);
  return <HostingLayout project={project} vm={vm} metadata={env.metadata} managed={{ env, editor }} showVariables />;
}

function HostingLayout({
  project,
  vm,
  metadata,
  managed,
  showVariables,
}: Readonly<{
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
  metadata: EnvVarMetadata[];
  managed: ManagedVariables | null;
  showVariables: boolean;
}>) {
  const idPrefix = useId();
  const hosting = useHostingTabViewModel({
    projectId: project.id,
    targets: vm.deploymentTargets,
    metadata,
    deployments: vm.deployments,
    deploymentsError: vm.deploymentsError,
    reloadDeployments: vm.reloadDeployments,
    previewsEnabled: vm.previewDeploymentsEnabled,
    initialTargetId: vm.logFocus?.targetId ?? null,
  });
  const targetsVm = useDeploymentTargetsViewModel({
    projectId: project.id,
    targets: vm.deploymentTargets,
    appRole: vm.appRole,
    onDetached: vm.handleTargetDetached,
    onTargetChanged: vm.handleTargetChanged,
  });
  const { target, environment } = hosting;
  const scope = {
    targetId: target.id,
    lane: environment.lane,
    branch: environmentScopeBranch(environment, hosting.previewBranch),
  };

  // A half-filled form belongs to the scope it was opened on: close it when the scope changes.
  function closeForm() {
    managed?.editor.setIsAddingVariable(false);
  }

  return (
    <div className="hosting-tab">
      <HostingServiceSelector
        targets={hosting.targets}
        selectedId={target.id}
        onSelect={(targetId) => {
          closeForm();
          hosting.selectTarget(targetId);
        }}
      />
      <HostingServiceHeader
        key={target.id}
        target={target}
        projectId={project.id}
        appRole={vm.appRole}
        managementEnabled={vm.projectTargetManagementEnabled}
        vm={targetsVm}
        logFocus={vm.logFocus}
        notice={hosting.notice}
        onRetry={hosting.retry}
      />
      <HostingEnvironmentSwitcher
        environments={hosting.environments}
        selected={environment.kind}
        idPrefix={idPrefix}
        onSelect={(kind: HostingEnvironmentKind) => {
          closeForm();
          hosting.selectEnvironment(kind);
        }}
      />
      <div
        className={`hosting-columns${showVariables ? "" : " hosting-columns--single"}`}
        role="tabpanel"
        id={environmentPanelId(idPrefix)}
        aria-labelledby={environmentTabId(idPrefix, environment.kind)}
      >
        <HostingDeploymentCard
          target={target}
          environment={environment}
          previews={hosting.previews}
          deploys={hosting.deploys}
          allDeploys={hosting.allDeploys}
          history={{
            enabled: vm.deploymentHistoryEnabled && vm.overview?.capabilities.deploymentHistory === true,
            response: vm.deployments,
          }}
          onOpenPullRequest={vm.visibleTabs.includes("pulls") ? vm.openPullRequest : undefined}
          domains={
            environment.kind === "production" ? <HostingDomains project={project} vm={vm} /> : null
          }
        />
        {showVariables ? (
          <HostingVariablesCard
            scope={scope}
            environment={environment}
            onPreviewBranchChange={(branch) => {
              closeForm();
              hosting.selectPreviewBranch(branch);
            }}
            metadata={metadata}
            managed={managed}
            providerName={providerDisplayName(target.provider)}
            focus={vm.hostingFocus === "variables"}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Production's custom domains, as the Hosting tab always offered them. */
function HostingDomains({ project, vm }: TabProps) {
  if (!vm.envProvisioningEnabled) return null;
  return (
    <div className="hosting-section">
      <h5 className="hosting-section__title" id="hosting-domains-heading">
        Custom domains
      </h5>
      <ProjectDomainsPanel
        canManage={canManageHosting(vm.appRole)}
        enabled
        projectId={project.id}
        targets={vm.deploymentTargets.map(domainTargetOption)}
        collapseAddForm
        // The service header already tells a read-only viewer who can change these.
        showReadOnlyNote={false}
      />
    </div>
  );
}

function domainTargetOption(target: DeploymentTarget): { id: string; label: string } {
  return {
    id: target.id,
    label: `${providerDisplayName(target.provider)} · ${target.providerProjectName}`,
  };
}

/** No service yet: what hosting gives this repository, and the way to add one. */
function HostingEmptyState({ project, vm }: TabProps) {
  const body = hostingEmptyBody({
    canManage: canManageHosting(vm.appRole),
    envProvisioningEnabled: vm.envProvisioningEnabled,
    provisioned: project.status === "provisioned",
  });
  return (
    <section className="hosting-card hosting-empty" aria-labelledby="hosting-empty-heading">
      <h3 className="hosting-empty__title" id="hosting-empty-heading">
        Host this repository
      </h3>
      <p className="hosting-quiet">Connect one hosting service and ALPHACI deploys this repository from Git:</p>
      <ul className="hosting-empty__points">
        <li>
          <code className="hosting-mono">main</code> publishes to Production.
        </li>
        <li>
          <code className="hosting-mono">uat</code> gets its own address, where QA checks it.
        </li>
        <li>Every other branch gets a preview.</li>
        <li>Variables are set per environment, and their values are never shown again.</li>
      </ul>
      <EmptyStateBody body={body} project={project} vm={vm} />
    </section>
  );
}

function EmptyStateBody({
  body,
  project,
  vm,
}: Readonly<{ body: HostingEmptyBody; project: ProvisionedProject; vm: ProjectDetailTabsViewModel }>) {
  if (body === "create") {
    return (
      <div className="hosting-empty__setup">
        <ProjectEnvPanel onTargetCreated={vm.handleTargetCreated} project={project} section="hosting" />
      </div>
    );
  }
  return <p className="env-empty-state">{EMPTY_NOTES[body]}</p>;
}

const EMPTY_NOTES: Record<Exclude<HostingEmptyBody, "create">, string> = {
  lead_only: HOSTING_LEAD_ONLY_NOTE,
  disabled: "Hosting service provisioning is not enabled.",
  not_provisioned: "A hosting service can be added once the repository is provisioned.",
};
