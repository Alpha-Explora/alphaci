/* The left rail's pin: open and pushing the page aside, or closed and opening
 * on hover. A per-viewer preference kept in this browser's localStorage.
 * Pure: no React, no DOM access beyond the string the boot script runs. */

export const SIDEBAR_PINNED_KEY = "alphaci.sidebar.pinned";

/** Set on <html>; the stylesheet widens the rail and the page's gutter off it. */
export const SIDEBAR_PINNED_ATTRIBUTE = "data-sidebar-pinned";

/** What storage holds, as the pin. Anything but "1" (or nothing) is unpinned. */
export function sidebarPinnedFrom(stored: string | null): boolean {
  return stored === "1";
}

export function storedSidebarPinned(pinned: boolean): "1" | "0" {
  return pinned ? "1" : "0";
}

/**
 * Runs in <head> before the first paint, so a pinned rail is open from the
 * first frame instead of opening (and shoving the page sideways) once React
 * hydrates. Storage can throw outright (private window, blocked site data);
 * the rail then just starts closed.
 */
export const SIDEBAR_PIN_BOOT_SCRIPT =
  `try{if(localStorage.getItem(${JSON.stringify(SIDEBAR_PINNED_KEY)})==="1")` +
  `document.documentElement.setAttribute(${JSON.stringify(SIDEBAR_PINNED_ATTRIBUTE)},"true")}catch(e){}`;
