"use client";

import {
  hostedTargetSeeds,
  hostingCreateFields,
  renderVariablesBlockingFor,
  wizardShape,
  type HostingCreateFields,
} from "../model/hosting-choice-rules";
import type { OnpremHosting } from "../model/onprem-hosting-rules";
import type { CreateProjectFormState } from "./use-create-project-form";
import { useDeploymentProvisioningForm } from "./use-deployment-provisioning-form";
import { useHostingChoice } from "./use-hosting-choice";
import type { ProjectOptionsCatalogState } from "./use-project-options-catalog";

/**
 * The create wizard's hosting: the project-wide Hosting choice, the Vercel /
 * Render targets (named after the repository until edited), whether the
 * Render-variable rule holds, and the create input the choice decides.
 */
export function useWizardHosting(input: {
  createForm: CreateProjectFormState;
  envProvisioningEnabled: boolean;
  onpremHosting: OnpremHosting;
  projectCatalog: ProjectOptionsCatalogState;
}) {
  const { createForm, envProvisioningEnabled, onpremHosting, projectCatalog } = input;
  const { layout, isDualShape, selectedProjectKind } = wizardShape(projectCatalog);
  // The targets' own on/off stays off: the Hosting choice decides, and the
  // existing-repo path keeps sending no provisioning, as before.
  const deploymentProvisioning = useDeploymentProvisioningForm(projectCatalog.selectedRepoShapeId, {
    seeds: hostedTargetSeeds({
      isDualShape,
      repoName: createForm.repoName,
      backendServiceName: createForm.backendServiceName,
      frontendServiceName: createForm.frontendServiceName,
      selectedProjectKind,
    }),
  });
  const hosting = useHostingChoice({ onprem: onpremHosting, layout, selectedProjectKind });

  /** The deployment fields of the create input, for the current choice. */
  function createFields(): HostingCreateFields {
    return hostingCreateFields({
      choice: hosting.choice,
      // Without provisioning on this deployment, nothing is sent and the
      // backend adds its default target, as it always has.
      hostedProvisioning: envProvisioningEnabled ? deploymentProvisioning.hostedPayload : undefined,
      environments: createForm.environments,
      onpremSlots: hosting.onpremSlots,
    });
  }

  return {
    deploymentProvisioning,
    hosting,
    /** Only Vercel / Render has a Render service to configure. */
    renderVariablesMissing: renderVariablesBlockingFor({
      choice: hosting.choice,
      provisioningOffered: envProvisioningEnabled,
      missing: deploymentProvisioning.hostedRenderVariablesMissing,
    }),
    createFields,
  };
}
