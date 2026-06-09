"use client";

import { useCallback, useEffect, useState } from "react";

import {
  createDeploymentTarget,
  listDeploymentTargets,
  listProjectEnvMetadata,
  listProviderConnections,
  provisionProjectEnvVars,
} from "@/lib/api/client";
import type {
  CreateDeploymentTargetRequest,
  DeploymentTarget,
  EnvVarMetadata,
  ProviderConnection,
  ProvisionEnvVarsRequest,
} from "@/lib/api/contracts";

export function useProjectEnvProvisioning(projectId: string, enabled = true) {
  const [targets, setTargets] = useState<DeploymentTarget[]>([]);
  const [metadata, setMetadata] = useState<EnvVarMetadata[]>([]);
  const [providerConnections, setProviderConnections] = useState<ProviderConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const [nextTargets, nextMetadata, nextProviderConnections] = await Promise.all([
        listDeploymentTargets(projectId),
        listProjectEnvMetadata(projectId),
        listProviderConnections(),
      ]);
      setTargets(nextTargets);
      setMetadata(nextMetadata);
      setProviderConnections(nextProviderConnections.filter((connection) => connection.status === "active"));
    } finally {
      setLoading(false);
    }
  }, [enabled, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

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

  return {
    addTarget,
    load,
    loading,
    metadata,
    providerConnections,
    provision,
    saving,
    targets,
  };
}
