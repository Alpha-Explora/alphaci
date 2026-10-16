"use client";

import { useEffect, useState, type CSSProperties } from "react";

/** The nearest ancestor that scrolls, whose scroll must not count as distance from the top. */
function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

/**
 * How far an element starts below the top of the window, ignoring scroll, so
 * the studio can run exactly to the bottom edge: the page under test and the
 * rail get every pixel, and nothing spills past the window. A fixed estimate
 * cannot do it, because the header and the tab row wrap at narrow widths.
 *
 * Re-measured when the window resizes, and when anything above the element
 * changes height: the toolbar moving into the tab row, a notice appearing.
 * Such a shift changes no size of the element itself, but it always changes
 * the height of an ancestor that holds both, so every ancestor up to the
 * scroll container is watched. Returns the callback ref to attach and the
 * style that carries the distance (`--qa-pane-top`); no style until measured
 * (server render), so CSS falls back to an estimate. jsdom reports 0.
 */
export function useStudioFitHeight<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    if (!element) return;
    const scroller = scrollParent(element);
    const measure = () => {
      const offset = element.getBoundingClientRect().top + (scroller?.scrollTop ?? 0);
      // Rounded up: at worst a pixel short of the bottom, never a pixel over (that would scroll the page).
      setTop(Math.max(0, Math.ceil(offset)));
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    for (let node: HTMLElement | null = element; node && node !== scroller; node = node.parentElement) {
      observer?.observe(node);
    }
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [element]);

  const style = top === null ? undefined : ({ "--qa-pane-top": `${top}px` } as CSSProperties);
  return { attach: setElement, style };
}
