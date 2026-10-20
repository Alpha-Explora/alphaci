"use client";

import { useCallback, useEffect, useState } from "react";

export interface StudioFullScreenState {
  /** The studio covers the viewport (in the page, not the browser's Fullscreen API). */
  isFullScreen: boolean;
  enterFullScreen: () => void;
  exitFullScreen: () => void;
  toggleFullScreen: () => void;
}

/**
 * Escape belongs to whatever is on top. A dialog (FormDialog listens on the
 * document too) or a menu that already handled the key keeps it; only an
 * Escape nobody else wanted acts. Checked when the key is pressed, because a
 * dialog can open and close while the studio stays as it is.
 */
export function escapeIsUnclaimed(event: Pick<KeyboardEvent, "key" | "defaultPrevented">): boolean {
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
      if (escapeIsUnclaimed(event)) exit();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;
    };
  }, [isFullScreen, exit]);
}

/**
 * UI state for the studio's full-screen mode. Pure presentation: nothing here
 * is fetched or sent. The run panel's own state (open, hidden, which side) is
 * the same in both modes and lives in useStudioPanel.
 */
export function useStudioFullScreen(): StudioFullScreenState {
  const [isFullScreen, setFullScreen] = useState(false);
  // Stable, so the Escape listener is not re-bound on every render.
  const exit = useCallback(() => setFullScreen(false), []);

  useFullScreenEffects(isFullScreen, exit);

  return {
    isFullScreen,
    enterFullScreen: () => setFullScreen(true),
    exitFullScreen: exit,
    toggleFullScreen: () => setFullScreen((value) => !value),
  };
}
