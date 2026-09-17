import type { CapabilitiesResponse, EnvOwnershipMode } from "@/shared/api/contracts";
import { PUBLIC_SITE_ENABLED } from "@/shared/composition/build-profile";

export type CapabilityViewFlags = {
  envProvisioningEnabled: boolean;
  clientCompositionEnabled: boolean;
  deploymentOwnershipMode: EnvOwnershipMode;
  projectSyncSnapshotsEnabled: boolean;
  workflowSettingsPreviewEnabled: boolean;
  workflowUpdatePrEnabled: boolean;
  projectTargetManagementEnabled: boolean;
  ciRunTrackingEnabled: boolean;
  deploymentHistoryEnabled: boolean;
  previewDeploymentsEnabled: boolean;
  driftDetectionEnabled: boolean;
  driftRepairEnabled: boolean;
  usageQuotasEnabled: boolean;
  workspacesEnabled: boolean;
  auditEventsEnabled: boolean;
  notificationsEnabled: boolean;
  publicSiteEnabled: boolean;
  hierarchyEnabled: boolean;
  hierarchyGithubSyncMode: "stub" | "live";
};

const DISABLED_CAPABILITY_FLAGS: CapabilityViewFlags = {
  envProvisioningEnabled: false,
  clientCompositionEnabled: false,
  deploymentOwnershipMode: "flowci_managed",
  projectSyncSnapshotsEnabled: false,
  workflowSettingsPreviewEnabled: false,
  workflowUpdatePrEnabled: false,
  projectTargetManagementEnabled: false,
  ciRunTrackingEnabled: false,
  deploymentHistoryEnabled: false,
  previewDeploymentsEnabled: false,
  driftDetectionEnabled: false,
  driftRepairEnabled: false,
  usageQuotasEnabled: false,
  workspacesEnabled: false,
  auditEventsEnabled: false,
  notificationsEnabled: false,
  publicSiteEnabled: false,
  hierarchyEnabled: false,
  hierarchyGithubSyncMode: "stub",
};

function optionalEnabled(flag: { enabled: boolean } | undefined): boolean {
  return flag?.enabled === true;
}

function ownershipMode(modes: EnvOwnershipMode[] | undefined): EnvOwnershipMode {
  return modes?.[0] === "byo" ? "byo" : "flowci_managed";
}

function hierarchySyncMode(
  hierarchy: CapabilitiesResponse["hierarchy"],
): "stub" | "live" {
  return hierarchy?.githubSyncMode ?? "stub";
}

export function capabilityViewFlags(
  capabilities: CapabilitiesResponse | null,
): CapabilityViewFlags {
  if (!capabilities) {
    return DISABLED_CAPABILITY_FLAGS;
  }
  const capabilityKeys = capabilities.capabilityKeys ?? [];
  return {
    envProvisioningEnabled: optionalEnabled(capabilities.envProvisioning),
    clientCompositionEnabled:
      capabilityKeys.includes("runtime.client-composition") &&
      capabilities.clientComposition?.enabled === true,
    deploymentOwnershipMode: ownershipMode(capabilities.envProvisioning?.modes),
    projectSyncSnapshotsEnabled: optionalEnabled(capabilities.projectSyncSnapshots),
    workflowSettingsPreviewEnabled: optionalEnabled(capabilities.workflowSettingsPreview),
    workflowUpdatePrEnabled: optionalEnabled(capabilities.workflowUpdatePr),
    projectTargetManagementEnabled: optionalEnabled(capabilities.projectTargetManagement),
    ciRunTrackingEnabled: optionalEnabled(capabilities.ciRunTracking),
    deploymentHistoryEnabled: optionalEnabled(capabilities.deploymentHistory),
    previewDeploymentsEnabled: optionalEnabled(capabilities.previewDeployments),
    driftDetectionEnabled: optionalEnabled(capabilities.driftDetection),
    driftRepairEnabled: optionalEnabled(capabilities.driftRepair),
    usageQuotasEnabled: optionalEnabled(capabilities.usageQuotas),
    workspacesEnabled: optionalEnabled(capabilities.workspaces),
    auditEventsEnabled: optionalEnabled(capabilities.auditEvents),
    notificationsEnabled: optionalEnabled(capabilities.notifications),
    publicSiteEnabled: PUBLIC_SITE_ENABLED,
    hierarchyEnabled: optionalEnabled(capabilities.hierarchy),
    hierarchyGithubSyncMode: hierarchySyncMode(capabilities.hierarchy),
  };
}
