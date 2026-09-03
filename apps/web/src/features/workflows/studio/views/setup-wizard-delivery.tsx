"use client";

import type { EnvOwnershipMode } from "@/shared/api/contracts";
import { formatQuotaStatus } from "../model/workflow-studio-rules";
import {
  defaultProjectName,
  projectKindToSlot,
} from "../model/setup-tab-rules";
import type { CreateProjectFormState } from "../view-models/use-create-project-form";
import type { DeploymentProvisioningFormState } from "../view-models/use-deployment-provisioning-form";
import type { ProjectOptionsCatalogState } from "../view-models/use-project-options-catalog";
import { DeploymentProvisioningSetup } from "./deployment-provisioning-setup";
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
  projectCatalog,
  projectQuota,
  selectedProjectKind,
}: Readonly<WizardStepProps>) {
  return (
    <>
      <DeliveryProvisioningPanel
        deploymentOwnershipMode={deploymentOwnershipMode}
        deploymentProvisioning={deploymentProvisioning}
        envProvisioningEnabled={envProvisioningEnabled}
        form={form}
        projectCatalog={projectCatalog}
        selectedProjectKind={selectedProjectKind}
      />
      <QuotaNotice projectQuota={projectQuota} />
      <RenderVariablesNotice missing={deploymentProvisioning.renderVariablesMissing} />
    </>
  );
}
