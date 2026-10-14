"use client";

import type { EnvOwnershipMode } from "@/shared/api/contracts";
import { formatQuotaStatus } from "../model/workflow-studio-rules";
import {
  ALL_ONPREM_DELIVERY_NOTICE,
  environmentHosting,
  mixedHostingLine,
  renderVariablesBlocking,
  type EnvironmentHosting,
} from "../model/onprem-hosting-rules";
import {
  defaultProjectName,
  projectKindToSlot,
} from "../model/setup-tab-rules";
import type { CreateProjectFormState } from "../view-models/use-create-project-form";
import type { DeploymentProvisioningFormState } from "../view-models/use-deployment-provisioning-form";
import type { ProjectOptionsCatalogState } from "../view-models/use-project-options-catalog";
import { DeploymentProvisioningSetup } from "./deployment-provisioning-setup";
import { SetupWizardEnvironments } from "./setup-wizard-environments";
import type { WizardStepProps } from "./setup-wizard-props";

function applyDeploymentDefaults(
  deploymentProvisioning: DeploymentProvisioningFormState,
  form: CreateProjectFormState,
  projectCatalog: ProjectOptionsCatalogState,
  selectedProjectKind: "frontend" | "backend",
) {
  if (projectCatalog.isMicroservicesShape || projectCatalog.isMultiRepoShape) {
    deploymentProvisioning.setDefaultTargets([
      {
        slot: "backend",
        projectName: defaultProjectName(
          form.backendServiceName,
          form.repoName,
          "backend",
        ),
      },
      {
        slot: "frontend",
        projectName: defaultProjectName(
          form.frontendServiceName,
          form.repoName,
          "frontend",
        ),
      },
    ]);
    return;
  }

  deploymentProvisioning.setDefaultTarget(
    projectKindToSlot(selectedProjectKind),
    defaultProjectName(form.serviceName, form.repoName),
  );
}

function handleDeploymentProvisioningEnabledChange(
  enabled: boolean,
  deploymentProvisioning: DeploymentProvisioningFormState,
  form: CreateProjectFormState,
  projectCatalog: ProjectOptionsCatalogState,
  selectedProjectKind: "frontend" | "backend",
) {
  if (!enabled) {
    deploymentProvisioning.setEnabled(false);
    return;
  }

  applyDeploymentDefaults(
    deploymentProvisioning,
    form,
    projectCatalog,
    selectedProjectKind,
  );
}

function QuotaNotice({
  projectQuota,
}: Readonly<{ projectQuota: WizardStepProps["projectQuota"] }>) {
  if (!projectQuota) {
    return null;
  }
  return (
    <div className="env-empty-state" role="status" style={{ marginTop: "1.25rem" }}>
      Project quota: {formatQuotaStatus(projectQuota)}
    </div>
  );
}

function RenderVariablesNotice({ missing }: Readonly<{ missing: boolean }>) {
  if (!missing) {
    return null;
  }
  return (
    <div className="env-empty-state" role="alert" style={{ marginTop: "1.25rem" }}>
      Add at least one Render environment variable before creating the repository.
    </div>
  );
}

/**
 * Where the environments run, when any of them is on-prem. Every environment
 * on-prem replaces the hosted configuration; a mix keeps it for the managed
 * environments and names the on-prem ones.
 */
function OnpremHostingNotice({ hosting }: Readonly<{ hosting: EnvironmentHosting }>) {
  if (hosting.mode === "managed") {
    return null;
  }
  return (
    <div className="env-empty-state" role="status" style={{ marginTop: "1.25rem" }}>
      {hosting.mode === "onprem" ? ALL_ONPREM_DELIVERY_NOTICE : mixedHostingLine(hosting)}
    </div>
  );
}

function DeliveryProvisioningPanel({
  deploymentOwnershipMode,
  deploymentProvisioning,
  envProvisioningEnabled,
  form,
  projectCatalog,
  selectedProjectKind,
}: Readonly<{
  deploymentOwnershipMode: EnvOwnershipMode;
  deploymentProvisioning: DeploymentProvisioningFormState;
  envProvisioningEnabled: boolean;
  form: CreateProjectFormState;
  projectCatalog: ProjectOptionsCatalogState;
  selectedProjectKind: "frontend" | "backend";
}>) {
  if (!envProvisioningEnabled) {
    return null;
  }

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <DeploymentProvisioningSetup
        enabled={deploymentProvisioning.enabled}
        ownershipMode={deploymentOwnershipMode}
        repoShape={projectCatalog.selectedRepoShapeId}
        selectedProjectKind={selectedProjectKind}
        value={deploymentProvisioning.request}
        onChange={deploymentProvisioning.setRequest}
        onEnabledChange={(enabled) =>
          handleDeploymentProvisioningEnabledChange(
            enabled,
            deploymentProvisioning,
            form,
            projectCatalog,
            selectedProjectKind,
          )
        }
      />
    </div>
  );
}

export function SetupWizardDelivery({
  deploymentOwnershipMode,
  deploymentProvisioning,
  envProvisioningEnabled,
  form,
  onpremHosting,
  projectCatalog,
  projectQuota,
  selectedProjectKind,
}: Readonly<WizardStepProps>) {
  const hosting = environmentHosting({
    environments: form.environments,
    environmentsEnabled: form.environmentsEnabled,
    isMicroservicesShape: projectCatalog.isMicroservicesShape,
    isMultiRepoShape: projectCatalog.isMultiRepoShape,
    onpremStatus: onpremHosting.status,
  });
  return (
    <>
      {projectCatalog.isMicroservicesShape || projectCatalog.isMultiRepoShape ? null : (
        <SetupWizardEnvironments form={form} onpremHosting={onpremHosting} />
      )}
      <OnpremHostingNotice hosting={hosting} />
      {/* Every environment on-prem: no Render or Vercel to configure. */}
      <DeliveryProvisioningPanel
        deploymentOwnershipMode={deploymentOwnershipMode}
        deploymentProvisioning={deploymentProvisioning}
        envProvisioningEnabled={envProvisioningEnabled && hosting.mode !== "onprem"}
        form={form}
        projectCatalog={projectCatalog}
        selectedProjectKind={selectedProjectKind}
      />
      <QuotaNotice projectQuota={projectQuota} />
      <RenderVariablesNotice
        missing={renderVariablesBlocking(
          deploymentProvisioning.renderVariablesMissing,
          hosting.mode,
        )}
      />
    </>
  );
}
