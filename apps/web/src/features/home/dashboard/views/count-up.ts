"use client";

import { useEffect, useRef, useState } from "react";

/* A rendering concern, not a view-model: it animates a number that is already
 * resolved. Kept beside the views that use it. */
export function useCountUp(target: number | null, duration = 900): number | null {
  const [count, setCount] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    if (target === null || target === 0) {
      const safeTarget = target;
      rafRef.current = requestAnimationFrame(() => {
        setCount(safeTarget);
      });
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      };
    }

    const safeTarget = target;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * safeTarget));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return count;
}

