"use client";

import { useCallback, useEffect, useState } from "react";

import {
  disabledCapabilities,
  getCapabilities,
} from "../data/capabilities-repository";
import type { CapabilitiesResponse } from "@/lib/api/contracts";

export type CapabilitiesStatus = "loading" | "ready" | "error";

export interface CapabilitiesViewModel {
  capabilities: CapabilitiesResponse | null;
  status: CapabilitiesStatus;
  error: string | null;
  loading: boolean;
  loadCapabilities: () => Promise<void>;
  envProvisioningEnabled: boolean;
  deploymentOwnershipMode: "byo" | "flowci_managed";
  projectSyncSnapshotsEnabled: boolean;
  workflowSettingsPreviewEnabled: boolean;
  workflowUpdatePrEnabled: boolean;
  projectTargetManagementEnabled: boolean;
  ciRunTrackingEnabled: boolean;
  deploymentHistoryEnabled: boolean;
  driftDetectionEnabled: boolean;
  driftRepairEnabled: boolean;
  usageQuotasEnabled: boolean;
  workspacesEnabled: boolean;
  auditEventsEnabled: boolean;
  notificationsEnabled: boolean;
  hierarchyEnabled: boolean;
  hierarchyGithubSyncMode: "stub" | "live";
}

export function useCapabilitiesViewModel(): CapabilitiesViewModel {
  const [capabilities, setCapabilities] = useState<CapabilitiesResponse | null>(null);
  const [status, setStatus] = useState<CapabilitiesStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const loadCapabilities = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      setCapabilities(await getCapabilities());
      setStatus("ready");
    } catch {
      setCapabilities(disabledCapabilities());
      setStatus("error");
      setError("Capabilities are unavailable right now; optional features are hidden.");
    }
  }, []);

  useEffect(() => {
    void loadCapabilities();
  }, [loadCapabilities]);

  return {
    capabilities,
    status,
    error,
    loading: status === "loading",
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
    driftDetectionEnabled: capabilities?.driftDetection?.enabled === true,
    driftRepairEnabled: capabilities?.driftRepair?.enabled === true,
    usageQuotasEnabled: capabilities?.usageQuotas?.enabled === true,
    workspacesEnabled: capabilities?.workspaces?.enabled === true,
    auditEventsEnabled: capabilities?.auditEvents?.enabled === true,
    notificationsEnabled: capabilities?.notifications?.enabled === true,
    hierarchyEnabled: capabilities?.hierarchy?.enabled === true,
    hierarchyGithubSyncMode: capabilities?.hierarchy?.githubSyncMode ?? "stub",
    loadCapabilities,
  };
}
