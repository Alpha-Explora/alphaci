"use client";

import { useEffect, useState, type KeyboardEvent, type RefObject } from "react";

/* The WAI-ARIA menu-button pattern, as behaviour only: the view supplies the
 * markup (button[aria-haspopup] + [role=menu] > [role=menuitem]).
 *
 *   - Enter / Space / ArrowDown on the button opens and focuses the first item;
 *     ArrowUp opens on the last.
 *   - ArrowUp / ArrowDown / Home / End move between items, wrapping.
 *   - Escape closes and returns focus to the button; Tab closes and lets focus
 *     move on; a pointer press outside closes without stealing focus. */

type Focus = "first" | "last";

const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"])';

/** The item to focus next. `index` is -1 when focus is not on an item. */
function step(key: string, index: number, count: number): number | null {
  if (key === "ArrowDown") return (index + 1) % count;
  if (key === "ArrowUp") return index <= 0 ? count - 1 : index - 1;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

export interface MenuButtonRefs {
  /** The button with aria-haspopup="menu". */
  triggerRef: RefObject<HTMLButtonElement | null>;
  /** The element with role="menu". */
  menuRef: RefObject<HTMLDivElement | null>;
}

export interface MenuButton {
  open: boolean;
  toggle: () => void;
  /** Close; focus returns to the button unless `returnFocus` is false. */
  close: (returnFocus?: boolean) => void;
  onTriggerKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onMenuKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/** The view owns the refs (it renders the elements); this owns the behaviour. */
export function useMenuButton({ triggerRef, menuRef }: MenuButtonRefs): MenuButton {
  const [open, setOpen] = useState(false);
  const [focusOnOpen, setFocusOnOpen] = useState<Focus>("first");

  function items(): HTMLElement[] {
    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
  }

  useEffect(() => {
    if (!open) return;
    const list = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    (focusOnOpen === "last" ? list[list.length - 1] : list[0])?.focus();
  }, [open, focusOnOpen, menuRef]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, menuRef, triggerRef]);

  function show(focus: Focus) {
    setFocusOnOpen(focus);
    setOpen(true);
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    show(event.key === "ArrowUp" ? "last" : "first");
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    const list = items();
    const next = step(event.key, list.indexOf(document.activeElement as HTMLElement), list.length);
    if (next === null || list.length === 0) return;
    event.preventDefault();
    list[next]?.focus();
  }

  return {
    open,
    toggle: () => (open ? close(false) : show("first")),
    close,
    onTriggerKeyDown,
    onMenuKeyDown,
  };
}
