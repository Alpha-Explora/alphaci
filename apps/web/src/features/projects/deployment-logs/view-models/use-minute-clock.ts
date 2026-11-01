"use client";

import { useEffect, useState } from "react";

/** The clock, re-read once a minute: enough for "quiet for 20 minutes". */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return now;
}
