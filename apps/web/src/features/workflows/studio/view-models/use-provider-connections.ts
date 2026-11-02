'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createProviderConnection,
  listProviderConnections,
  revokeProviderConnection,
} from '@/features/workflows/studio/data/env-provisioning-api';
import type {
  CreateProviderConnectionRequest,
  ProviderConnection,
} from '@/shared/api/contracts';

export function useProviderConnections(enabled = true) {
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  // Loading until a read settles; `loadConnections` (a handler) clears it to read again.
  const [settled, setSettled] = useState(false);
  const [saving, setSaving] = useState(false);
  const requestRef = useRef(0);
  const loading = enabled && !settled;

  const read = useCallback(async () => {
    requestRef.current += 1;
    const requestId = requestRef.current;
    try {
      const next = await listProviderConnections();
      if (requestId === requestRef.current) setConnections(next);
    } finally {
      if (requestId === requestRef.current) setSettled(true);
    }
  }, []);

  useEffect(() => {
    if (enabled) void read();
  }, [enabled, read]);

  const loadConnections = useCallback(async () => {
    if (!enabled) return;
    setSettled(false);
    await read();
  }, [enabled, read]);

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
        connection.id === id
          ? { ...connection, status: 'revoked' }
          : connection,
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
