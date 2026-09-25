"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The content box of an element, kept current as it resizes. The device
 * preview needs it to fit a 768px tablet into a 500px pane.
 *
 * jsdom has no ResizeObserver; the size then stays 0 × 0 and every scale rule
 * treats an unmeasured pane as "draw at 100%".
 */
export function usePaneSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const box = ref.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  return { ref, ...size };
}
