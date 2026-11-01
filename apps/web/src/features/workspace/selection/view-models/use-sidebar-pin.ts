"use client";

import { useSyncExternalStore } from "react";

import {
  SIDEBAR_PINNED_ATTRIBUTE,
  SIDEBAR_PINNED_KEY,
  sidebarPinnedFrom,
  storedSidebarPinned,
} from "../model/sidebar-pin";

const listeners = new Set<() => void>();

/* The pin when storage refused to keep it: still true for this page. */
let unsaved: boolean | null = null;

function readPinned(): boolean {
  if (unsaved !== null) return unsaved;
  try {
    return sidebarPinnedFrom(window.localStorage.getItem(SIDEBAR_PINNED_KEY));
  } catch {
    return false;
  }
}

/** The stylesheet reads the pin from <html>, so the page's gutter follows it too. */
function applyPinned(pinned: boolean): void {
  if (pinned) document.documentElement.setAttribute(SIDEBAR_PINNED_ATTRIBUTE, "true");
  else document.documentElement.removeAttribute(SIDEBAR_PINNED_ATTRIBUTE);
}

function notify(): void {
  for (const listener of listeners) listener();
}

/* Another tab pinning or unpinning: follow it, so two tabs never disagree. */
function onStorage(event: StorageEvent): void {
  if (event.key !== SIDEBAR_PINNED_KEY) return;
  applyPinned(readPinned());
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/**
 * Whether the left rail is pinned open, and a toggle.
 *
 * useSyncExternalStore rather than useState: storage is external state, the
 * server cannot see it (its snapshot is "unpinned"), and the boot script in
 * the root layout has already set <html> before hydration, so the only thing
 * React renders from this is the toggle's pressed state.
 */
export function useSidebarPin(): [boolean, () => void] {
  const pinned = useSyncExternalStore(subscribe, readPinned, () => false);

  function toggle() {
    const next = !readPinned();
    try {
      window.localStorage.setItem(SIDEBAR_PINNED_KEY, storedSidebarPinned(next));
      unsaved = null;
    } catch {
      // Not remembered across visits; the pin still applies for this page.
      unsaved = next;
    }
    applyPinned(next);
    notify();
  }

  return [pinned, toggle];
}
