"use client";
import { useEffect, useState } from "react";
import { listHosts, type MachineSummary } from "@/features/hosts";
import { useWorkspaceSelection } from "@/features/workspace/selection";
export function useSetupHostSelection() {
  const { selectedWorkspaceId } = useWorkspaceSelection();
  const [loaded, setLoaded] = useState<{
      workspaceId: string;
      hosts: MachineSummary[];
    } | null>(null),
    [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!selectedWorkspaceId) return;
    let active = true;
    listHosts(selectedWorkspaceId)
      .then((hosts) => {
        if (active) {
          setError(null);
          setLoaded({
            workspaceId: selectedWorkspaceId,
            hosts: hosts.filter(
              (host) =>
                host.status !== "revoked" &&
                host.status !== "enrollment_pending",
            ),
          });
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Host inventory is unavailable. You can assign a host from Hosting after creation.",
          );
      });
    return () => {
      active = false;
    };
  }, [selectedWorkspaceId, revision]);
  return {
    workspaceId: selectedWorkspaceId,
    hosts: loaded?.workspaceId === selectedWorkspaceId ? loaded.hosts : [],
    error,
    refresh: () => setRevision((value) => value + 1),
  };
}
