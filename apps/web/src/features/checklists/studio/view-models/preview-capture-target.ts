"use client";

import { createContext, useContext, type RefObject } from "react";

/* Where a "Capture" screenshot is cropped to: QA Studio's preview iframe.
 *
 * The preview and the run column are siblings in the studio, so the studio
 * owns one ref, hands it to the iframe, and offers it to every item below
 * through this context. Outside QA Studio (the Project page's QA workspace)
 * there is no preview: the context is null and Capture is not offered, while
 * Paste and Upload still are. */

export type PreviewCaptureTarget = RefObject<HTMLIFrameElement | null>;

export const PreviewCaptureContext = createContext<PreviewCaptureTarget | null>(null);

export function usePreviewCaptureTarget(): PreviewCaptureTarget | null {
  return useContext(PreviewCaptureContext);
}
