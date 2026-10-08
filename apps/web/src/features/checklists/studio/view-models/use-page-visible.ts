"use client";

import { useSyncExternalStore } from "react";

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function pageVisible(): boolean {
  return document.visibilityState !== "hidden";
}

function serverVisible(): boolean {
  return true;
}

/** Whether the browser tab is showing: pollers pause while it is hidden. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribeVisibility, pageVisible, serverVisible);
}
