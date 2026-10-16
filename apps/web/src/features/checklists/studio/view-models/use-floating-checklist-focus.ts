"use client";

import { useEffect, useRef } from "react";

interface Mode {
  isFullScreen: boolean;
  isChecklistOpen: boolean;
}

type FocusTarget = "drawer" | "launcher" | "toggle" | null;

/** Nothing useful has focus: the element that had it was hidden or removed. */
function focusLost(): boolean {
  const active = document.activeElement;
  return active === null || active === document.body;
}

/**
 * Where focus goes after a change of mode, so a keyboard user is never left
 * on a control that just disappeared. The same docked and in full screen:
 *   - the panel is opened → into the panel;
 *   - it is hidden → back to the button that reopens it;
 *   - full screen starts or ends and focus was lost with the control that had
 *     it → the Full screen toggle. The toolbar itself changes places (the tab
 *     row docked, a bar atop the studio in full screen), so the toggle that was
 *     pressed is gone and its twin in the new place takes focus.
 */
function focusTarget(was: Mode, now: Mode): FocusTarget {
  if (was.isFullScreen !== now.isFullScreen) return focusLost() ? "toggle" : null;
  if (!was.isChecklistOpen && now.isChecklistOpen) return "drawer";
  if (was.isChecklistOpen && !now.isChecklistOpen) return "launcher";
  return null;
}

/**
 * Focus handling for the floating run panel. The refs go on the three elements
 * focus moves between: the panel's heading (focusable, tabIndex -1), the
 * button that reopens it and the toolbar's Full screen toggle.
 */
export function useFloatingChecklistFocus(mode: Mode) {
  const drawerRef = useRef<HTMLHeadingElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const previous = useRef<Mode>(mode);
  const { isFullScreen, isChecklistOpen } = mode;

  useEffect(() => {
    const now = { isFullScreen, isChecklistOpen };
    const target = focusTarget(previous.current, now);
    previous.current = now;
    const refs = { drawer: drawerRef, launcher: launcherRef, toggle: toggleRef };
    if (target) refs[target].current?.focus();
  }, [isFullScreen, isChecklistOpen]);

  return { drawerRef, launcherRef, toggleRef };
}
