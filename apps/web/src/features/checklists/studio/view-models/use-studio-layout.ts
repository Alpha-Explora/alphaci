"use client";

import { resolveStudioLayout, type StudioLayout } from "../../model/qa-studio-rules";
import { useRememberedChoice } from "./use-remembered-flag";

export const STUDIO_LAYOUT_KEY = "alphaci.qa-studio.layout";

export interface StudioLayoutState {
  /**
   * How the docked studio shares its width: "wide" (the default) or "split".
   * Applied as a data attribute on the studio, so changing it only restyles:
   * the frame and the run column stay mounted.
   */
  layout: StudioLayout;
  setLayout: (layout: StudioLayout) => void;
}

/**
 * The studio's docked layout, remembered per viewer in this browser. Part of
 * the studio shell (it rides on the viewport ViewModel with full screen), so
 * any studio built on that shell gets the same choice.
 */
export function useStudioLayout(): StudioLayoutState {
  const [layout, setLayout] = useRememberedChoice(STUDIO_LAYOUT_KEY, resolveStudioLayout);
  return { layout, setLayout };
}
