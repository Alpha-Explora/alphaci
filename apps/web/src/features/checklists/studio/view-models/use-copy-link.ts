"use client";

import { useEffect, useRef, useState } from "react";

export type CopyLinkStatus = "idle" | "copied" | "failed";

/** How long "Copied" stays before the button goes back to offering a copy. */
export const COPY_LINK_RESET_MS = 2_000;

export interface CopyLinkState {
  status: CopyLinkStatus;
  copy: () => Promise<void>;
}

/**
 * Copy a link to the clipboard so the tester can hand it to someone else. The
 * status reverts on its own, and a copy that is refused (no permission, an
 * insecure context, no clipboard at all) says so rather than looking like it
 * worked: the link is not on screen to select by hand.
 */
export function useCopyLink(url: string | null): CopyLinkState {
  const [status, setStatus] = useState<CopyLinkStatus>("idle");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    if (!url) return;
    let next: CopyLinkStatus = "copied";
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      next = "failed";
    }
    setStatus(next);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus("idle"), COPY_LINK_RESET_MS);
  }

  return { status, copy };
}
