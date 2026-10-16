"use client";

import { useState } from "react";

import { studioRailPinnedKey } from "../../model/qa-studio-rules";
import { useRememberedFlag } from "./use-remembered-flag";

export interface StudioPanelState {
  /**
   * The run rail is pinned open and the page moves aside. Unpinned, it is a
   * strip that opens over the page on hover or keyboard focus (CSS alone, as
   * the app's left rail does). Either way the same panel stays mounted, so
   * drafts, the sign-off dialog and automation polling carry on untouched.
   */
  isRailPinned: boolean;
  toggleRailPinned: () => void;
  /**
   * True from an unpin until the pointer leaves the rail: unpinning under the
   * cursor would otherwise leave it open on hover, and the press would seem
   * to do nothing. Keyboard focus is never suppressed.
   */
  railHoverSuppressed: boolean;
  releaseRailHover: () => void;
}

/**
 * The run rail's state, the same docked and in full screen. Pinned or not is
 * remembered per viewer and per studio in this browser; a first visit is
 * unpinned, like the app's left rail.
 */
export function useStudioPanel(studio: "qa" | "po"): StudioPanelState {
  const [isRailPinned, togglePinned] = useRememberedFlag(studioRailPinnedKey(studio), false);
  const [railHoverSuppressed, setSuppressed] = useState(false);

  return {
    isRailPinned,
    toggleRailPinned: () => {
      if (isRailPinned) setSuppressed(true);
      togglePinned();
    },
    railHoverSuppressed,
    releaseRailHover: () => setSuppressed(false),
  };
}
