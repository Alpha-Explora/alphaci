"use client";
import { useEffect, useState } from "react";
import { isOnpremHostingAvailable } from "../data/hosts-api";

export function useHostAvailability(active: boolean) {
  const [status, setStatus] = useState<"loading" | "enabled" | "disabled">(
    "loading",
  );
  useEffect(() => {
    if (!active) return;
    const abort = new AbortController();
    void isOnpremHostingAvailable(abort.signal)
      .then((enabled) => {
        if (!abort.signal.aborted) setStatus(enabled ? "enabled" : "disabled");
      })
      .catch(() => {
        if (!abort.signal.aborted) setStatus("disabled");
      });
    return () => abort.abort();
  }, [active]);
  return active ? status : "disabled";
}
