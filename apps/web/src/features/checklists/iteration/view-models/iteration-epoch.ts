"use client";

import { useSyncExternalStore } from "react";

/* One counter per Project that grows each time its next iteration starts.
 *
 * A Project page reads its iteration, requirements, QA run and My QA items
 * through separate ViewModels, each with its own state; after a start every
 * one of them must read again. Each folds the Project's counter into what it
 * watches, so one announcement refreshes them all, wherever they are mounted.
 * External state, so useSyncExternalStore (the server snapshot is always 0). */

const epochs = new Map<string, number>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tell every screen of this Project that its iteration changed: they read again. */
export function announceIterationChanged(deliveryProjectId: string): void {
  epochs.set(deliveryProjectId, (epochs.get(deliveryProjectId) ?? 0) + 1);
  for (const listener of listeners) listener();
}

/** The Project's counter: 0 until its iteration changes on this page. */
export function useIterationEpoch(deliveryProjectId: string | null): number {
  return useSyncExternalStore(
    subscribe,
    () => (deliveryProjectId ? (epochs.get(deliveryProjectId) ?? 0) : 0),
    () => 0,
  );
}
