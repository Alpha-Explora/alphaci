"use client";

import { useState } from "react";

import { resolveStudioPanel, studioPanelKey } from "../../model/qa-studio-rules";
import { useRememberedChoice } from "./use-remembered-flag";

/** Which edge of the preview the run panel floats over. */
export type FloatingSide = "right" | "left";

export interface StudioPanelState {
  /**
   * Whether the run panel (Checklist | Playwright) floats over the preview.
   * Hidden, the same panel stays mounted, so drafts, the sign-off dialog and
   * automation polling carry on untouched; a button brings it back.
   */
  isChecklistOpen: boolean;
  floatingSide: FloatingSide;
  openChecklist: () => void;
  hideChecklist: () => void;
  toggleChecklist: () => void;
  /** Move the panel (and its button) to the other edge. */
  snapChecklist: () => void;
}

/**
 * The run panel's state, the same docked and in full screen. Open or hidden
 * is remembered per viewer and per studio in this browser; the side is for
 * this visit only.
 */
export function useStudioPanel(studio: "qa" | "po"): StudioPanelState {
  const [panel, choose] = useRememberedChoice(studioPanelKey(studio), resolveStudioPanel);
  const [floatingSide, setFloatingSide] = useState<FloatingSide>("right");
  const isChecklistOpen = panel === "open";

  return {
    isChecklistOpen,
    floatingSide,
    openChecklist: () => choose("open"),
    hideChecklist: () => choose("hidden"),
    toggleChecklist: () => choose(isChecklistOpen ? "hidden" : "open"),
    snapChecklist: () => setFloatingSide((side) => (side === "right" ? "left" : "right")),
  };
}
