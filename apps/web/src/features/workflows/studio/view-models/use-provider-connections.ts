"use client";

import { useCallback, useEffect, useState } from "react";

import {
  createProviderConnection,
  listProviderConnections,
  revokeProviderConnection,
} from "@/features/workflows/studio/data/env-provisioning-api";
import type {
  CreateProviderConnectionRequest,
  ProviderConnection,
} from "@/shared/api/contracts";

export function useProviderConnections(enabled = true) {
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadConnections = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      setConnections(await listProviderConnections());
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  async function saveConnection(payload: CreateProviderConnectionRequest) {
    setSaving(true);
    try {
      const connection = await createProviderConnection(payload);
      setConnections((current) => [connection, ...current]);
      return connection;
    } finally {
      setSaving(false);
    }
  }

  async function revokeConnection(id: string) {
    await revokeProviderConnection(id);
    setConnections((current) =>
      current.map((connection) =>
        connection.id === id ? { ...connection, status: "revoked" } : connection,
      ),
    );
  }

  return {
    connections,
    loadConnections,
    loading,
    revokeConnection,
    saveConnection,
    saving,
  };
}
