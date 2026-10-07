"use client";

import { useEffect, useState, type FocusEvent, type KeyboardEvent, type RefObject } from "react";

/* A disclosure button with a non-modal panel under it (WAI-ARIA disclosure),
 * as behaviour only: the view renders button[aria-expanded][aria-controls]
 * and the panel, both inside one root element.
 *
 *   - The button toggles the panel; focus stays on the button.
 *   - Escape (on the button or in the panel) closes and returns focus to the
 *     button, and marks the key handled, so it does not also leave the
 *     studio's full screen.
 *   - A pointer press outside the root closes without moving focus.
 *   - Focus moving out of the root (Tab past the panel, say) closes too. */

export interface DisclosurePopoverRefs {
  /** The disclosure button. */
  triggerRef: RefObject<HTMLButtonElement | null>;
  /** The element holding the button and the panel. */
  rootRef: RefObject<HTMLElement | null>;
}

export interface DisclosurePopover {
  open: boolean;
  toggle: () => void;
  /** Close; focus returns to the button unless `returnFocus` is false. */
  close: (returnFocus?: boolean) => void;
  /** On the root: Escape closes. */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  /** On the root (React's onBlur bubbles): focus leaving the root closes. */
  onBlur: (event: FocusEvent<HTMLElement>) => void;
}

export function useDisclosurePopover({ triggerRef, rootRef }: DisclosurePopoverRefs): DisclosurePopover {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: Event) {
      if (rootRef.current?.contains(event.target as Node | null)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, rootRef]);

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!open || event.key !== "Escape") return;
    event.preventDefault();
    close(true);
  }

  function onBlur(event: FocusEvent<HTMLElement>) {
    // No next target: a press on something unfocusable, which the pointer
    // listener judges (a press inside the panel keeps it open).
    const next = event.relatedTarget as Node | null;
    if (!open || !next || rootRef.current?.contains(next)) return;
    setOpen(false);
  }

  return { open, toggle: () => setOpen((value) => !value), close, onKeyDown, onBlur };
}
