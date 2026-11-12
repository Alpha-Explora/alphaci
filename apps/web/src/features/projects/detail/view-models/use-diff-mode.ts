'use client';

import { useSyncExternalStore } from 'react';

import {
  DIFF_MODE_STORAGE_KEY,
  readDiffMode,
  type DiffMode,
} from '../model/unified-diff';

const listeners = new Set<() => void>();

/* The choice when storage refused to keep it: still applies for this page. */
let unsaved: DiffMode | null = null;

function readMode(): DiffMode {
  if (unsaved !== null) return unsaved;
  try {
    return readDiffMode(window.localStorage.getItem(DIFF_MODE_STORAGE_KEY));
  } catch {
    return 'unified';
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent): void {
  if (event.key === DIFF_MODE_STORAGE_KEY) notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

/**
 * Unified or side-by-side, remembered in this browser. useSyncExternalStore:
 * the server cannot see storage (its snapshot is unified), so the first client
 * render matches it and then follows the stored choice.
 */
export function useDiffMode(): [DiffMode, (mode: DiffMode) => void] {
  const mode = useSyncExternalStore(
    subscribe,
    readMode,
    (): DiffMode => 'unified',
  );
  return [
    mode,
    (next: DiffMode) => {
      try {
        window.localStorage.setItem(DIFF_MODE_STORAGE_KEY, next);
        unsaved = null;
      } catch {
        // Not remembered across visits; the choice lasts for this page.
        unsaved = next;
      }
      notify();
    },
  ];
}
