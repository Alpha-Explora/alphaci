"use client";

import { useCallback, useEffect, useState } from "react";

import {
  createDeploymentTarget,
  deleteProjectEnvMetadata,
  listDeploymentTargets,
  listProjectEnvMetadata,
  listProviderConnections,
  provisionProjectEnvVars,
  validateProjectEnvVars,
} from "@/features/workflows";
import type {
  CreateDeploymentTargetRequest,
  DeploymentTarget,
  EnvVarMetadata,
  ProviderConnection,
  ProvisionEnvVarsRequest,
  UsageLimitItem,
  ValidateEnvVarsRequest,
} from "@/shared/api/contracts";
import { getMyUsage } from "../data/usage-api";

/**
 * @param includeEnvMetadata Skip `GET .../env-vars` when the caller will not
 * render it — the Hosting tab reuses this hook only for its target-creation
 * prompt (`section="hosting"`), never the variables list. Every role reaches
 * Hosting, and the backend now restricts that read to admin/lead
 * (`ENV_VARS_LEAD_ONLY`), so fetching it unconditionally would 403 for
 * everyone else on a tab that never displayed the result anyway.
 */
export function useProjectEnvProvisioning(
  projectId: string,
  enabled = true,
  includeEnvMetadata = true,
) {
  const [targets, setTargets] = useState<DeploymentTarget[]>([]);
  const [metadata, setMetadata] = useState<EnvVarMetadata[]>([]);
  const [providerConnections, setProviderConnections] = useState<ProviderConnection[]>([]);
  const [usageItems, setUsageItems] = useState<UsageLimitItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const [nextTargets, nextMetadata, nextProviderConnections] = await Promise.all([
        listDeploymentTargets(projectId),
        includeEnvMetadata ? listProjectEnvMetadata(projectId) : Promise.resolve([]),
        listProviderConnections(),
      ]);
      setTargets(nextTargets);
      setMetadata(nextMetadata);
      setProviderConnections(nextProviderConnections.filter((connection) => connection.status === "active"));
    } finally {
      setLoading(false);
    }
  }, [enabled, includeEnvMetadata, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void getMyUsage()
      .then((usage) => {
        if (!cancelled && usage.enabled) {
          setUsageItems(usage.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUsageItems([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function addTarget(payload: CreateDeploymentTargetRequest) {
    setSaving(true);
    try {
      const target = await createDeploymentTarget(projectId, payload);
      setTargets((current) => [target, ...current]);
      return target;
    } finally {
      setSaving(false);
    }
  }

  async function provision(payload: ProvisionEnvVarsRequest) {
    setSaving(true);
    try {
      const result = await provisionProjectEnvVars(projectId, payload);
      await load();
      return result;
    } finally {
      setSaving(false);
    }
  }

  async function validateEnvText(payload: ValidateEnvVarsRequest) {
    return validateProjectEnvVars(projectId, payload);
  }

  async function removeMetadata(metadataId: string) {
    setSaving(true);
    try {
      const result = await deleteProjectEnvMetadata(projectId, metadataId);
      await load();
      return result;
    } finally {
      setSaving(false);
    }
  }

  return {
    addTarget,
    load,
    loading,
    metadata,
    providerConnections,
    provision,
    removeMetadata,
    saving,
    targets,
    usageItems,
    validateEnvText,
  };
}
