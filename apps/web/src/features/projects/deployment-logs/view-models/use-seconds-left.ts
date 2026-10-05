"use client";

import { useEffect, useState } from "react";

import { secondsUntil } from "../model/log-rate-limit";

/**
 * Whole seconds until `until` (epoch ms), ticking once a second. Null in, null
 * out, and no timer runs. The tick stops by itself at zero.
 */
export function useSecondsLeft(until: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until === null) return;
    const end = until;
    function tick() {
      const current = Date.now();
      setNow(current);
      if (current >= end) clearInterval(timer);
    }
    // An immediate re-read, because `now` is stale if the cooldown just began.
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [until]);

  return until === null ? null : secondsUntil(until, now);
}
