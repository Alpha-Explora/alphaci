"use client";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/shared/api/request";
import { downloadBlob } from "@/shared/browser/download-blob";
import { createHostEnrollment, listHosts, revokeHost } from "../data/hosts-api";
import {
  enrollmentInstallFile,
  installFileSupported,
} from "../model/enrollment-install-file";
import {
  enrollmentProgress,
  type EnrollmentReceipt,
  type HostPlatform,
  type MachineSummary,
} from "../model/host-types";
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
    [platform, setPlatform] = useState<HostPlatform>("windows");
  const [adding, setAdding] = useState(false),
    [enrolled, setEnrolled] = useState<{
      name: string;
      platform: HostPlatform;
    } | null>(null);
  const [now, setNow] = useState(Date.now()),
    [reload, setReload] = useState(0);
  const progress =
    receipt && enrolled
      ? enrollmentProgress(receipt, enrolled.name, hosts, now)
      : null;
  // While a fresh code waits for its machine, check in faster so the page
  // flips to "connected" moments after the installer finishes.
  const waiting = progress === "waiting";
  const pending = useRef(false),
    scope = useRef<string | null>(workspaceId);
  useEffect(() => {
    scope.current = workspaceId;
    return () => {
      scope.current = null;
    };
  }, [workspaceId]);
  useEffect(() => {
    if (!waiting) return;
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(tick);
  }, [waiting]);
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
    const timer = setInterval(
      () => {
        setNow(Date.now());
        void load();
      },
      waiting ? 3_000 : 10_000,
    );
    return () => {
      active = false;
      abort.abort();
      clearInterval(timer);
    };
  }, [workspaceId, reload, enabled, waiting]);
  async function enroll(replacement?: MachineSummary) {
    if (!canManage || pending.current) return;
    if (replacement && confirmation !== `replace:${replacement.id}`) {
      setConfirmation(`replace:${replacement.id}`);
      return;
    }
    const target = {
      name: replacement?.name ?? name.trim(),
      platform: replacement?.platform ?? platform,
    };
    await perform(async () => {
      const result = await createHostEnrollment(workspaceId, {
        name: target.name,
        platform: target.platform,
        requestId: crypto.randomUUID(),
        ...(replacement ? { replacesMachineId: replacement.id } : {}),
      });
      if (scope.current === workspaceId) {
        setReceipt(result);
        setEnrolled(target);
        setAdding(false);
        setName("");
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
  /** Saves the install file for the enrollment on screen. The code goes only into that file. */
  function downloadInstallFile() {
    if (!receipt || !enrolled || !installFileSupported(receipt.installer.version))
      return;
    try {
      const file = enrollmentInstallFile(
        receipt,
        enrolled.platform,
        enrolled.name,
      );
      downloadBlob(
        file.filename,
        new Blob([file.contents], { type: file.mimeType }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not build the install file.",
      );
    }
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
          cause instanceof ApiError && cause.status === 503 &&
          cause.message === "Configure the public HTTPS API address first."
            ? "Host setup isn’t ready. Ask your administrator to configure AlphaCI’s public HTTPS address, then try again."
            : cause instanceof Error ? cause.message : "Host operation failed. Try again in a moment.",
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
    enrolled,
    progress,
    adding,
    busy,
    confirmation,
    name,
    setName,
    platform,
    setPlatform,
    now,
    expired: progress === "expired",
    enroll,
    revoke,
    downloadInstallFile,
    /** False for installer versions that predate install files. */
    canDownloadInstallFile: Boolean(
      receipt && installFileSupported(receipt.installer.version),
    ),
    startAdding: () => {
      setAdding(true);
      setConfirmation(null);
    },
    closeAdding: () => setAdding(false),
    dismiss: () => {
      setReceipt(null);
      setEnrolled(null);
    },
    cancel: () => setConfirmation(null),
  };
}
