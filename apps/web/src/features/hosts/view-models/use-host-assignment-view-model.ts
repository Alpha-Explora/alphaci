"use client";
import { useEffect, useRef, useState } from "react";
import { listHosts } from "../data/hosts-api";
import {
  assignHost,
  getAssignment,
  getAssignmentDefaults,
  getReadiness,
  unassignHost,
} from "../data/assignments-api";
import {
  fallbackAssignmentDefaults,
  healthyHosts,
  requestedConfig,
  type AssignmentRequestConfig,
  type HostAssignment,
  type MachineSummary,
  type ReadinessCheck,
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
  // Replaced on load by the backend's defaults for this environment.
  const [config, setConfig] = useState<AssignmentRequestConfig>(() => ({
    ...fallbackAssignmentDefaults(options.slots),
    ingress: { mode: production ? "tunnel" : "direct", publicUrl: null },
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
  // The 20 s timer below reads the stored assignment's mode and this
  // environment through a ref, so it sees current values without restarting.
  const tunnelWatch = useRef({ projectId, environmentId, tunnel: false });
  // Each authoritative read or write of the assignment takes a new number. A
  // timer read lands only if no later one was started, so a slow poll cannot
  // put back an assignment that a load, assign or unassign already replaced.
  const serverRead = useRef(0);
  // The assignment a replace or unassign confirmation was opened against.
  const confirmedFor = useRef<string | null>(null);
  useEffect(() => {
    tunnelWatch.current = {
      projectId,
      environmentId,
      tunnel: current?.config?.ingress.mode === "tunnel",
    };
  }, [projectId, environmentId, current]);
  useEffect(() => {
    let relevant = true;
    Promise.all([
      listHosts(workspaceId),
      getAssignment(projectId, environmentId),
      getReadiness(projectId, environmentId),
      // The port and health path of the project's own app. Without them (an
      // older backend) the form keeps the fallback.
      getAssignmentDefaults(projectId, environmentId).catch(() => null),
    ])
      .then(([machines, assignment, readiness, defaults]) => {
        if (!relevant) return;
        serverRead.current += 1;
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
          setConfig(requestedConfig(assignment.config));
        } else if (defaults) {
          setConfig((old) => ({
            ...old,
            ports: defaults.ports,
            health: defaults.health,
          }));
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
  // Connection status is derived from lastSeenAt, so a machine list loaded once
  // turns every host "Offline" ninety seconds later. Refresh just the machines
  // on every tick. While the stored assignment is in tunnel mode the same tick
  // also re-reads it with its readiness, and the server's answer replaces what
  // is shown (its tunnel report, id, revision, machine, mode). The form's own
  // edits live in `config`, `selected` and `confirmation`, which this never
  // touches.
  useEffect(() => {
    const refreshTunnel = () => {
      const watched = tunnelWatch.current;
      if (!watched.tunnel) return;
      const read = ++serverRead.current;
      Promise.all([
        getAssignment(watched.projectId, watched.environmentId),
        getReadiness(watched.projectId, watched.environmentId),
      ])
        .then(([assignment, readiness]) => {
          // Only the newest read lands, and nothing lands after unmount.
          if (!active.current || read !== serverRead.current) return;
          setChecks(readiness.checks);
          setCurrent(assignment);
        })
        .catch(() => {
          // Keep the last assignment and checks; the next tick retries.
        });
    };
    const timer = setInterval(() => {
      listHosts(workspaceId)
        .then((machines) => {
          if (!active.current) return;
          setHosts(
            machines.filter(
              (host) =>
                host.status !== "revoked" &&
                host.status !== "enrollment_pending",
            ),
          );
        })
        .catch(() => {
          // Keep the last list; the next tick retries.
        });
      refreshTunnel();
    }, 20_000);
    return () => clearInterval(timer);
  }, [workspaceId]);
  // A picker is needed only when several machines could take the environment;
  // with exactly one, the server assigns it without a choice.
  const choices = healthyHosts(hosts);
  const automatic = choices.length === 1 ? choices[0]! : null;
  const machineId = selected || automatic?.id || "";
  // A confirmation survives refreshes untouched, but it only sends for the
  // assignment it was opened against. If the server has since replaced or
  // removed that assignment, the click is refused and the user reviews again.
  // Returns true only when a confirmation is open for this assignment.
  function confirmed(kind: "replace" | "unassign"): boolean {
    if (confirmation !== kind) {
      confirmedFor.current = current?.id ?? null;
      setConfirmation(kind);
      return false;
    }
    if (confirmedFor.current === (current?.id ?? null)) return true;
    confirmedFor.current = null;
    setConfirmation(null);
    setError(
      "The assignment changed on the server since you confirmed. Review it, then confirm again.",
    );
    return false;
  }
  function requestIdFor(key: string): string {
    if (request.current?.key !== key)
      request.current = { key, id: crypto.randomUUID() };
    return request.current.id;
  }
  async function assign() {
    if (!canManage || pending.current || !machineId) return;
    // A replacement is confirmed first: one click opens it, the next sends.
    if ((current || confirmation === "replace") && !confirmed("replace"))
      return;
    const requestId = requestIdFor(
      JSON.stringify({ machineId, current: current?.id, config }),
    );
    await perform(async () => {
      const result = await assignHost(projectId, environmentId, {
        ...(selected ? { machineId: selected } : {}),
        expectedAssignmentId: current?.id ?? null,
        requestId,
        config,
      });
      if (active.current) {
        serverRead.current += 1;
        setCurrent(result);
        setConfirmation(null);
        setReload((value) => value + 1);
      }
    });
  }
  async function unassign() {
    if (!canManage || !current || pending.current) return;
    if (!confirmed("unassign")) return;
    pending.current = true;
    setBusy(true);
    try {
      await unassignHost(projectId, environmentId, current.id);
      if (active.current) {
        serverRead.current += 1;
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
  function port(slot: "frontend" | "backend", value: string) {
    setConfig((old) => ({
      ...old,
      ports: old.ports.map((item) =>
        item.slot === slot ? { ...item, containerPort: Number(value) } : item,
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
    /** Machines to choose between; the picker shows only for several. */
    choices,
    /** The only healthy machine, used without asking. */
    automatic,
    canAssign: Boolean(machineId),
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
