"use client";

import { useEffect, useRef, useState } from "react";

import { iterationsRepository } from "../../data/iterations-repository";
import type { CurrentIteration } from "../../model/iteration-types";
import { useIterationEpoch } from "./iteration-epoch";

/**
 * `idle`: nothing to read (no Project, or not enabled). `unavailable`: the
 * route is missing (an older backend's 404), failed, or named no iteration —
 * every screen then shows nothing iteration-related, exactly as before.
 */
export type CurrentIterationStatus = "idle" | "loading" | "ready" | "unavailable";

export interface CurrentIterationViewModel {
  status: CurrentIterationStatus;
  /** The last answer read. Kept on screen while a refresh is in flight. */
  current: CurrentIteration | null;
  reload: () => void;
}

interface Loaded {
  key: string;
  current: CurrentIteration | null;
}

function statusOf(active: boolean, loaded: Loaded | null): CurrentIterationStatus {
  if (!active) return "idle";
  if (!loaded) return "loading";
  return loaded.current ? "ready" : "unavailable";
}

/**
 * Re-read when `watch` changes between two known values (adjusted during
 * render, React's documented way to react to a changed input): PO Studio
 * passes what the promotion status says about delivery, so a merge from the
 * tab bar refreshes the iteration too.
 */
function useWatchedReload(watch: string | null, reload: () => void) {
  const [seen, setSeen] = useState(watch);
  if (watch !== seen) {
    setSeen(watch);
    if (seen !== null && watch !== null) reload();
  }
}

/**
 * ViewModel for a Project's current iteration: "Iteration 3 · Active" in the
 * Project header, the lock on a delivered iteration's requirements, and PO
 * Studio's per-repository delivery state. The iteration is an enhancement on
 * screens that work without it, so any failure is `unavailable`, never an
 * error the viewer has to read. A request counter stops a slow read for the
 * previous Project overwriting the one on screen. A started iteration
 * (announced through the Project's epoch) reads it again.
 */
export function useCurrentIterationViewModel(options: {
  deliveryProjectId: string | null;
  enabled: boolean;
  watch?: string | null;
}): CurrentIterationViewModel {
  const { deliveryProjectId, enabled, watch } = options;
  const [nonce, setNonce] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const requestRef = useRef(0);
  const key = deliveryProjectId ?? "";
  const active = enabled && Boolean(deliveryProjectId);
  const reload = () => setNonce((value) => value + 1);
  useWatchedReload(watch ?? null, reload);
  const epoch = useIterationEpoch(active ? key : null);

  useEffect(() => {
    if (!active) return;
    requestRef.current += 1;
    const requestId = requestRef.current;
    // Through a promise, so even a reader that returns nothing reads as "unavailable".
    Promise.resolve()
      .then(() => iterationsRepository.current(key))
      .then((current) => {
        if (requestId === requestRef.current) setLoaded({ key, current: current ?? null });
      })
      .catch(() => {
        // A failed refresh keeps what was on screen; a first read hides the iteration.
        if (requestId !== requestRef.current) return;
        setLoaded((previous) => (previous?.key === key && previous.current ? previous : { key, current: null }));
      });
  }, [active, key, nonce, epoch]);

  const current = loaded?.key === key ? loaded : null;
  return {
    status: statusOf(active, current),
    current: active ? (current?.current ?? null) : null,
    reload,
  };
}
