"use client";

import { useEffect, useRef } from "react";

/** Nothing useful has focus: the element that had it was hidden or removed. */
function focusLost(): boolean {
  const active = document.activeElement;
  return active === null || active === document.body;
}

/**
 * Focus across full screen, so a keyboard user is never left on a control
 * that just disappeared. The toolbar changes places (the tab row docked, a
 * bar atop the studio in full screen), so the Full screen toggle that was
 * pressed is gone and its twin in the new place takes focus. The run rail
 * needs nothing here: its pin never leaves, and opening on focus is CSS.
 */
export function useFloatingChecklistFocus(mode: { isFullScreen: boolean }) {
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const previous = useRef(mode.isFullScreen);
  const { isFullScreen } = mode;

  useEffect(() => {
    const changed = previous.current !== isFullScreen;
    previous.current = isFullScreen;
    if (changed && focusLost()) toggleRef.current?.focus();
  }, [isFullScreen]);

  return { toggleRef };
}
