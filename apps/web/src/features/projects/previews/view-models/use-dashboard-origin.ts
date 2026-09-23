"use client";

import { useSyncExternalStore } from "react";

/* The origin never changes for the life of the page, so nothing to subscribe to. */
function subscribe() {
  return () => {};
}

/**
 * The dashboard's own origin, or null during the server render.
 *
 * A frame's sandbox is fixed when it first navigates, so it must not mount
 * until the origin is known: a strict sandbox rendered on the server and
 * relaxed after hydration would never take effect, and the mismatch would warn.
 */
export function useDashboardOrigin(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => null,
  );
}
