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
 * on a control that just disappeared:
 *   - the drawer is opened in full screen → into the drawer;
 *   - it is minimized → back to the launcher that reopens it;
 *   - full screen starts or ends and focus was lost with the control that had
 *     it → the Full screen toggle. The toolbar itself changes places (the tab
 *     row docked, a bar atop the studio in full screen), so the toggle that was
 *     pressed is gone and its twin in the new place takes focus; so does the
 *     toggle when the drawer's Dock button disappears.
 */
function focusTarget(was: Mode, now: Mode): FocusTarget {
  if (was.isFullScreen !== now.isFullScreen) return focusLost() ? "toggle" : null;
  if (!now.isFullScreen) return null;
  if (!was.isChecklistOpen && now.isChecklistOpen) return "drawer";
  if (was.isChecklistOpen && !now.isChecklistOpen) return "launcher";
  return null;
}

/**
 * Focus handling for the floating checklist. The refs go on the three elements
 * focus moves between: the drawer's heading (focusable, tabIndex -1), the
 * launcher pill and the toolbar's Full screen toggle.
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
