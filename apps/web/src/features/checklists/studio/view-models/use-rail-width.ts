"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

import {
  clampRailWidth,
  parseRailWidth,
  RAIL_WIDTH_DEFAULT,
  RAIL_WIDTH_MIN,
  RAIL_WIDTH_STEP,
  railWidthMax,
  studioRailWidthKey,
} from "../../model/qa-studio-rules";
import { useRememberedChoice } from "./use-remembered-flag";

export interface RailResizeHandleProps {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onDoubleClick: () => void;
  "aria-valuenow": number;
  "aria-valuemin": number;
}

export interface RailWidthViewModel {
  /** The open panel's width in pixels; null is the default (30rem). */
  width: number | null;
  /** A drag is in progress: the studio stops selecting text and the preview stops taking the pointer. */
  resizing: boolean;
  /** For the studio's root: sets --qa-rail-width, which the rail and the pinned page padding read. */
  style: CSSProperties | undefined;
  handle: RailResizeHandleProps;
}

interface Drag {
  pointerId: number;
  startX: number;
  startWidth: number;
  max: number;
}

/** The room the studio's panes give the rail, read from the handle's place in the page. */
function availableFor(element: HTMLElement): number {
  const panes = element.closest(".qa-studio__panes");
  return railWidthMax(panes ? panes.clientWidth : window.innerWidth);
}

function currentWidth(element: HTMLElement, fallback: number): number {
  const rail = element.closest(".qa-rail");
  const measured = rail?.getBoundingClientRect().width ?? 0;
  return measured > 0 ? measured : fallback;
}

/**
 * ViewModel for the run rail's width: the QA checklist panel opens at 30rem,
 * and its left edge drags it wider (towards the page) or narrower. Pinned,
 * the page moves aside by the same amount. Arrow keys on the edge do the
 * same in steps; a double-click goes back to the default. The width is
 * remembered per studio in this browser.
 */
export function useRailWidth(studio: "qa" | "po"): RailWidthViewModel {
  const [stored, remember] = useRememberedChoice<string>(studioRailWidthKey(studio), (raw) => raw ?? "");
  const [live, setLive] = useState<number | null>(null);
  const drag = useRef<Drag | null>(null);
  const width = live ?? parseRailWidth(stored);

  function widthAt(event: PointerEvent<HTMLElement>, current: Drag): number {
    return clampRailWidth(current.startWidth + current.startX - event.clientX, current.max);
  }

  function finish(event: PointerEvent<HTMLElement>, keep: boolean) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (keep) remember(String(widthAt(event, current)));
    setLive(null);
  }

  return {
    width,
    resizing: live !== null,
    style: width === null ? undefined : ({ "--qa-rail-width": `${String(width)}px` } as CSSProperties),
    handle: {
      onPointerDown: (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const element = event.currentTarget;
        // preventDefault keeps text from being selected, and with it the
        // browser's own focus: focus the edge so the open-on-focus rule holds
        // an unpinned panel open for the whole drag.
        element.focus({ preventScroll: true });
        const startWidth = currentWidth(element, width ?? RAIL_WIDTH_DEFAULT);
        drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth, max: availableFor(element) };
        element.setPointerCapture?.(event.pointerId);
        setLive(clampRailWidth(startWidth, drag.current.max));
      },
      onPointerMove: (event) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        setLive(widthAt(event, current));
      },
      onPointerUp: (event) => finish(event, true),
      onPointerCancel: (event) => finish(event, false),
      onKeyDown: (event) => {
        const element = event.currentTarget;
        const max = availableFor(element);
        const now = currentWidth(element, width ?? RAIL_WIDTH_DEFAULT);
        const next: Record<string, number> = {
          ArrowLeft: now + RAIL_WIDTH_STEP,
          ArrowRight: now - RAIL_WIDTH_STEP,
          Home: RAIL_WIDTH_MIN,
          End: max,
        };
        const target = next[event.key];
        if (target === undefined) return;
        event.preventDefault();
        remember(String(clampRailWidth(target, max)));
      },
      onDoubleClick: () => remember(""),
      "aria-valuenow": Math.round(width ?? RAIL_WIDTH_DEFAULT),
      "aria-valuemin": RAIL_WIDTH_MIN,
    },
  };
}
