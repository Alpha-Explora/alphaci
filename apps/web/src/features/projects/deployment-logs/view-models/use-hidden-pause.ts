"use client";

import { useEffect, useState } from "react";

/** How long the tab must stay hidden before the live tail is given up. */
export const HIDDEN_PAUSE_MS = 30_000;

/**
 * True once the document has been hidden for `delayMs` without a break.
 *
 * Not on the first `hidden`: switching tabs for a moment would close and
 * reopen the stream (and re-read the snapshot from the provider) for nothing.
 * Only a tab left idle in the background pays for the pause, which is the one
 * that was costing provider calls. Becoming visible clears it at once.
 */
export function useHiddenPause(delayMs: number = HIDDEN_PAUSE_MS): boolean {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function arm() {
      clearTimeout(timer);
      timer = setTimeout(() => setPaused(true), delayMs);
    }
    function onChange() {
      if (document.visibilityState === "hidden") {
        arm();
        return;
      }
      clearTimeout(timer);
      setPaused(false);
    }
    // Mounted into a background tab: the clock starts now.
    if (document.visibilityState === "hidden") arm();
    document.addEventListener("visibilitychange", onChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onChange);
    };
  }, [delayMs]);

  return paused;
}
