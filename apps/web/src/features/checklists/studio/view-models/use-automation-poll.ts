"use client";

import { useEffect, useRef } from "react";

import { AUTOMATION_POLL_INTERVAL_MS } from "../../model/qa-automation-rules";
import { usePageVisible } from "./use-page-visible";

/** After "Run Playwright": re-read from `since` until `until` (epoch ms). */
export interface PollWindow {
  since: number;
  until: number;
}

/**
 * Re-reads a run every 20 s while `poll` is open and the page is visible,
 * hands each answer over, and stops once `settled` says the results arrived
 * or the window closed. A hidden tab pauses (the window keeps closing);
 * unmount, or a new `key` (another run), stops. A missed read is not worth a
 * message: the next tick tries again. A slow answer that a newer read or a
 * stop overtook is dropped.
 */
export function useAutomationPoll<T>(options: {
  /** Which run this is: a change restarts the timer. */
  key: string;
  poll: PollWindow | null;
  read: () => Promise<T>;
  onValue: (value: T) => void;
  settled: (value: T, sinceMs: number) => boolean;
  onStop: () => void;
}): void {
  const { key, poll } = options;
  const visible = usePageVisible();
  const callbacks = useRef(options);
  const requestRef = useRef(0);

  useEffect(() => {
    callbacks.current = options;
  });

  useEffect(() => {
    if (!poll || !visible) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= poll.until) {
        callbacks.current.onStop();
        return;
      }
      requestRef.current += 1;
      const requestId = requestRef.current;
      callbacks.current
        .read()
        .then((value) => {
          if (requestId !== requestRef.current) return;
          callbacks.current.onValue(value);
          if (callbacks.current.settled(value, poll.since)) callbacks.current.onStop();
        })
        .catch(() => undefined);
    }, AUTOMATION_POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      requestRef.current += 1;
    };
  }, [poll, visible, key]);
}
