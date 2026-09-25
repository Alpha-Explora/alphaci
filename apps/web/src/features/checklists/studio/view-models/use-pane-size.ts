"use client";

import { useEffect, useState } from "react";

/**
 * The content box of an element (padding excluded), kept current as it
 * resizes. The device preview needs it to fit a 1440 × 900 desktop into a
 * 700px pane, and to refit when the studio goes full screen.
 *
 * The ref is a callback ref held in state, so the observer follows the element
 * if it is ever replaced rather than watching a detached node forever.
 *
 * jsdom has no ResizeObserver; the size then stays 0 × 0 and every scale rule
 * treats an unmeasured pane as "draw at 100%".
 */
export function usePaneSize<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return { ref: setElement, ...size };
}
