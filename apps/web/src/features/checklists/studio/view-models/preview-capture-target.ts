"use client";

import { createContext, useContext, type RefObject } from "react";

/* Where a "Capture" screenshot is cropped to: QA Studio's preview iframe.
 *
 * The preview and the run column are siblings in the studio, so the studio
 * owns one ref, hands it to the iframe, and offers it to every item below
 * through this context. Outside QA Studio (the Project page's QA workspace)
 * there is no preview: the context is null and Capture is not offered, while
 * Paste and Upload still are. */

export interface PreviewCaptureTarget extends RefObject<HTMLIFrameElement | null> {
  /**
   * Runs a capture with whatever floats over the preview (the run panel, its
   * button) made transparent, then puts it back. A capture takes the tab's
   * pixels where the iframe is, so anything drawn on top of the page would be
   * in the evidence. Absent where nothing floats over the frame.
   */
  whileCapturing?: <T>(capture: () => Promise<T>) => Promise<T>;
}

export const PreviewCaptureContext = createContext<PreviewCaptureTarget | null>(null);

export function usePreviewCaptureTarget(): PreviewCaptureTarget | null {
  return useContext(PreviewCaptureContext);
}
