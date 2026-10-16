"use client";

import { useState } from "react";

import type { PreviewCaptureTarget } from "./preview-capture-target";

/** Two frames: the transparent panel is painted before anything is grabbed. */
function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * The studio's capture target: the preview iframe's ref, plus the hiding of
 * the floating run panel for as long as a capture runs. `capturing` goes on
 * the studio as a data attribute; CSS makes the panel transparent (never
 * hidden or removed, so the focused Capture button keeps focus and nothing
 * remounts).
 *
 * One object for the studio's lifetime: the iframe takes it as its ref and
 * the run column reads it from context.
 */
export function useStudioCaptureTarget(): { target: PreviewCaptureTarget; capturing: boolean } {
  const [capturing, setCapturing] = useState(false);
  const [target] = useState<PreviewCaptureTarget>(() => ({
    current: null,
    whileCapturing: async (capture) => {
      setCapturing(true);
      try {
        await afterPaint();
        return await capture();
      } finally {
        setCapturing(false);
      }
    },
  }));
  return { target, capturing };
}
