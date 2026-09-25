"use client";

import { useCallback, useEffect, useState } from "react";

/** Which bottom corner the floating checklist sits in. */
export type FloatingSide = "right" | "left";

export interface StudioFullScreenState {
  /** The studio covers the viewport (in the page, not the browser's Fullscreen API). */
  isFullScreen: boolean;
  /**
   * Full screen only: whether the floating checklist drawer is shown. When it
   * is not, the same checklist stays mounted and hidden, so drafts, the
   * sign-off dialog and automation polling carry on untouched.
   */
  isChecklistOpen: boolean;
  floatingSide: FloatingSide;
  enterFullScreen: () => void;
  exitFullScreen: () => void;
  toggleFullScreen: () => void;
  openChecklist: () => void;
  minimizeChecklist: () => void;
  toggleChecklist: () => void;
  /** Move the drawer (and its launcher) to the other bottom corner. */
  snapChecklist: () => void;
}

/**
 * Escape belongs to whatever is on top. A dialog (FormDialog listens on the
 * document too) or a menu that already handled the key keeps it; only an
 * Escape nobody else wanted leaves full screen. Checked when the key is
 * pressed, because a dialog can open and close while full screen stays on.
 */
function escapeLeavesFullScreen(event: KeyboardEvent): boolean {
  if (event.key !== "Escape" || event.defaultPrevented) return false;
  return document.querySelector('[role="dialog"]') === null;
}

/**
 * While full screen: the page behind must not scroll, and Escape leaves.
 * The body's own overflow is put back exactly as it was on exit or unmount.
 */
function useFullScreenEffects(isFullScreen: boolean, exit: () => void) {
  useEffect(() => {
    if (!isFullScreen) return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (escapeLeavesFullScreen(event)) exit();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;
    };
  }, [isFullScreen, exit]);
}

/**
 * UI state for the studio's full-screen mode and its floating checklist.
 * Pure presentation: nothing here is fetched or sent.
 */
export function useStudioFullScreen(): StudioFullScreenState {
  const [isFullScreen, setFullScreen] = useState(false);
  const [isChecklistOpen, setChecklistOpen] = useState(false);
  const [floatingSide, setFloatingSide] = useState<FloatingSide>("right");
  // Stable, so the Escape listener is not re-bound on every render.
  const exit = useCallback(() => setFullScreen(false), []);

  useFullScreenEffects(isFullScreen, exit);

  return {
    isFullScreen,
    isChecklistOpen,
    floatingSide,
    enterFullScreen: () => setFullScreen(true),
    exitFullScreen: exit,
    toggleFullScreen: () => setFullScreen((value) => !value),
    openChecklist: () => setChecklistOpen(true),
    minimizeChecklist: () => setChecklistOpen(false),
    toggleChecklist: () => setChecklistOpen((value) => !value),
    snapChecklist: () => setFloatingSide((side) => (side === "right" ? "left" : "right")),
  };
}
