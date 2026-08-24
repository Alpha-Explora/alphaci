"use client";

import { useCallback, useEffect, useState } from "react";

import { getCapabilities } from "@/lib/api/client";
import type { CapabilitiesResponse } from "@/lib/api/contracts";

export function useCapabilities() {
  const [capabilities, setCapabilities] = useState<CapabilitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCapabilities = useCallback(async () => {
    setLoading(true);
    try {
      setCapabilities(await getCapabilities());
    } catch {
      setCapabilities({
        envProvisioning: { enabled: false, providers: [], environments: [], modes: [] },
        projectSyncSnapshots: {
          enabled: false,
          liveGithubEnabled: false,
          liveProvidersEnabled: false,
          mode: "local_snapshot",
        },
        workflowSettingsPreview: { enabled: false },
        workflowUpdatePr: { enabled: false },
        projectTargetManagement: { enabled: false },
        ciRunTracking: { enabled: false, liveGithubEnabled: false, mode: "local_mock" },
        deploymentHistory: { enabled: false, liveProvidersEnabled: false, mode: "local_mock" },
        driftDetection: { enabled: false, liveProviderChecksEnabled: false, mode: "local_snapshot" },
        driftRepair: { enabled: false, liveRepairEnabled: false, mode: "local_safe" },
        usageQuotas: { enabled: false },
        workspaces: { enabled: false },
        auditEvents: { enabled: false },
        notifications: { enabled: false },
        hierarchy: { enabled: false, githubSyncMode: "stub" },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCapabilities();
  }, [loadCapabilities]);

  return {
    capabilities,
    envProvisioningEnabled: capabilities?.envProvisioning?.enabled === true,
    // Single ownership mode this deployment offers. 'flowci_managed' = deploys
    // are centralized on the organization's Render/Vercel; 'byo' = users connect
    // their own provider accounts. Defaults to 'flowci_managed' (the safer,
    // centralized choice) while capabilities are still loading or on fetch
    // failure, so BYO UI never flashes/appears unless the backend explicitly
    // advertises it.
    deploymentOwnershipMode:
      capabilities?.envProvisioning?.modes?.[0] === "byo"
        ? ("byo" as const)
        : ("flowci_managed" as const),
    projectSyncSnapshotsEnabled: capabilities?.projectSyncSnapshots?.enabled === true,
    workflowSettingsPreviewEnabled: capabilities?.workflowSettingsPreview?.enabled === true,
    workflowUpdatePrEnabled: capabilities?.workflowUpdatePr?.enabled === true,
    projectTargetManagementEnabled: capabilities?.projectTargetManagement?.enabled === true,
    ciRunTrackingEnabled: capabilities?.ciRunTracking?.enabled === true,
    deploymentHistoryEnabled: capabilities?.deploymentHistory?.enabled === true,
    previewDeploymentsEnabled: capabilities?.previewDeployments?.enabled === true,
    driftDetectionEnabled: capabilities?.driftDetection?.enabled === true,
    driftRepairEnabled: capabilities?.driftRepair?.enabled === true,
    usageQuotasEnabled: capabilities?.usageQuotas?.enabled === true,
    workspacesEnabled: capabilities?.workspaces?.enabled === true,
    auditEventsEnabled: capabilities?.auditEvents?.enabled === true,
    notificationsEnabled: capabilities?.notifications?.enabled === true,
    hierarchyEnabled: capabilities?.hierarchy?.enabled === true,
    hierarchyGithubSyncMode: capabilities?.hierarchy?.githubSyncMode ?? "stub",
    loadCapabilities,
    loading,
  };
}
