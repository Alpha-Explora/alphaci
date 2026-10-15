"use client";
import { useEffect, useRef, useState } from "react";
import { createHostEnrollment, listHosts, revokeHost } from "../data/hosts-api";
import type { EnrollmentReceipt, MachineSummary } from "../model/host-types";
export function useHostsViewModel(
  workspaceId: string,
  canManage: boolean,
  enabled = true,
) {
  const [hosts, setHosts] = useState<MachineSummary[]>([]),
    [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null),
    [receipt, setReceipt] = useState<EnrollmentReceipt | null>(null);
  const [busy, setBusy] = useState(false),
    [confirmation, setConfirmation] = useState<string | null>(null);
  const [name, setName] = useState(""),
    [platform, setPlatform] = useState<"windows" | "ubuntu">("windows");
  const [now, setNow] = useState(Date.now()),
    [reload, setReload] = useState(0);
  const pending = useRef(false),
    scope = useRef<string | null>(workspaceId);
  useEffect(() => {
    scope.current = workspaceId;
    return () => {
      scope.current = null;
    };
  }, [workspaceId]);
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    let active = true;
    const load = () =>
      listHosts(workspaceId, abort.signal)
        .then((items) => {
          if (active) {
            setHosts(items);
            setStatus("ready");
          }
        })
        .catch((cause: unknown) => {
          if (active) {
            setStatus("error");
            setError(
              cause instanceof Error ? cause.message : "Unable to load hosts.",
            );
          }
        });
    void load();
    const timer = setInterval(() => {
      setNow(Date.now());
      void load();
    }, 10_000);
    return () => {
      active = false;
      abort.abort();
      clearInterval(timer);
    };
  }, [workspaceId, reload, enabled]);
  async function enroll(replacement?: MachineSummary) {
    if (!canManage || pending.current) return;
    if (replacement && confirmation !== `replace:${replacement.id}`) {
      setConfirmation(`replace:${replacement.id}`);
      return;
    }
    await perform(async () => {
      const result = await createHostEnrollment(workspaceId, {
        name: replacement?.name ?? name,
        platform: replacement?.platform ?? platform,
        requestId: crypto.randomUUID(),
        ...(replacement ? { replacesMachineId: replacement.id } : {}),
      });
      if (scope.current === workspaceId) {
        setReceipt(result);
        setConfirmation(null);
        setReload((value) => value + 1);
      }
    });
  }
  async function revoke(host: MachineSummary) {
    if (!canManage || pending.current) return;
    if (confirmation !== `revoke:${host.id}`) {
      setConfirmation(`revoke:${host.id}`);
      return;
    }
    await perform(async () => {
      await revokeHost(workspaceId, host.id);
      if (scope.current === workspaceId) {
        setReload((value) => value + 1);
        setConfirmation(null);
      }
    });
  }
  async function perform(action: () => Promise<void>) {
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      if (scope.current === workspaceId)
        setError(
          cause instanceof Error ? cause.message : "Host operation failed.",
        );
    } finally {
      pending.current = false;
      if (scope.current === workspaceId) setBusy(false);
    }
  }
  return {
    hosts,
    status,
    error,
    receipt,
    busy,
    confirmation,
    name,
    setName,
    platform,
    setPlatform,
    now,
    expired: Boolean(receipt && Date.parse(receipt.expiresAt) <= now),
    enroll,
    revoke,
    dismiss: () => setReceipt(null),
    cancel: () => setConfirmation(null),
  };
}
