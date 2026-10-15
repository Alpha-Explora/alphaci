"use client";
import { useEffect, useRef, useState } from "react";
import { listHosts } from "../data/hosts-api";
import {
  assignHost,
  getAssignment,
  getReadiness,
  unassignHost,
} from "../data/assignments-api";
import type {
  AssignmentConfig,
  HostAssignment,
  MachineSummary,
  ReadinessCheck,
} from "../model/host-types";
export interface HostAssignmentOptions {
  projectId: string;
  environmentId: string;
  workspaceId: string;
  slots: ReadonlyArray<"frontend" | "backend">;
  production: boolean;
  canManage: boolean;
}
export function useHostAssignmentViewModel(options: HostAssignmentOptions) {
  const { projectId, environmentId, workspaceId, production, canManage } =
    options;
  const [hosts, setHosts] = useState<MachineSummary[]>([]),
    [current, setCurrent] = useState<HostAssignment | null>(null);
  const [checks, setChecks] = useState<ReadinessCheck[]>([]),
    [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
      "loading",
    ),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  const [selected, setSelected] = useState(""),
    [confirmation, setConfirmation] = useState<"replace" | "unassign" | null>(
      null,
    );
  const [config, setConfig] = useState<AssignmentConfig>(() => ({
    ports: options.slots.map((slot, index) => ({
      slot,
      hostPort: 8080 + index,
      containerPort: slot === "frontend" ? 3000 : 4000,
    })),
    health: options.slots.map((slot) => ({ slot, path: "/" })),
    ingress: { mode: production ? "configured" : "direct", publicUrl: null },
  }));
  const pending = useRef(false),
    active = useRef(true),
    request = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    let relevant = true;
    Promise.all([
      listHosts(workspaceId),
      getAssignment(projectId, environmentId),
      getReadiness(projectId, environmentId),
    ])
      .then(([machines, assignment, readiness]) => {
        if (!relevant) return;
        setHosts(
          machines.filter(
            (host) =>
              host.status !== "revoked" && host.status !== "enrollment_pending",
          ),
        );
        setCurrent(assignment);
        setChecks(readiness.checks);
        setStatus("ready");
        setError(null);
        if (assignment?.config) {
          setSelected(assignment.machineId);
          setConfig(assignment.config);
        }
      })
      .catch((cause: unknown) => {
        if (relevant) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to read host assignment.",
          );
          setStatus("error");
        }
      });
    return () => {
      relevant = false;
    };
  }, [workspaceId, projectId, environmentId, reload]);
  async function assign() {
    if (!canManage || pending.current || !selected) return;
    if (current && confirmation !== "replace") {
      setConfirmation("replace");
      return;
    }
    const key = JSON.stringify({ selected, current: current?.id, config });
    if (request.current?.key !== key)
      request.current = { key, id: crypto.randomUUID() };
    const requestId = request.current.id;
    await perform(async () => {
      const result = await assignHost(projectId, environmentId, {
        machineId: selected,
        expectedAssignmentId: current?.id ?? null,
        requestId,
        config,
      });
      if (active.current) {
        setCurrent(result);
        setConfirmation(null);
        setReload((value) => value + 1);
      }
    });
  }
  async function unassign() {
    if (!canManage || !current || pending.current) return;
    if (confirmation !== "unassign") {
      setConfirmation("unassign");
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      await unassignHost(projectId, environmentId, current.id);
      if (active.current) {
        setCurrent(null);
        setConfirmation(null);
        setReload((value) => value + 1);
      }
    } catch (cause) {
      if (active.current)
        setError(
          cause instanceof Error ? cause.message : "Unassignment failed.",
        );
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function perform(action: () => Promise<void>) {
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      if (active.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Assignment failed. Reload after a conflict, or retry after a network error.",
        );
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }
  function port(
    slot: "frontend" | "backend",
    field: "hostPort" | "containerPort",
    value: string,
  ) {
    setConfig((old) => ({
      ...old,
      ports: old.ports.map((item) =>
        item.slot === slot ? { ...item, [field]: Number(value) } : item,
      ),
    }));
    setConfirmation(null);
  }
  function health(slot: "frontend" | "backend", value: string) {
    setConfig((old) => ({
      ...old,
      health: old.health.map((item) =>
        item.slot === slot ? { ...item, path: value || null } : item,
      ),
    }));
    setConfirmation(null);
  }
  return {
    hosts,
    current,
    checks,
    error,
    status,
    busy,
    selected,
    setSelected: (value: string) => {
      setSelected(value);
      setConfirmation(null);
    },
    config,
    setConfig: (value: Parameters<typeof setConfig>[0]) => {
      setConfig(value);
      setConfirmation(null);
    },
    confirmation,
    cancel: () => setConfirmation(null),
    assign,
    unassign,
    port,
    health,
    reload: () => setReload((value) => value + 1),
  };
}
