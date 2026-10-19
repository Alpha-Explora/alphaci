"use client";

import type { RailWidthViewModel } from "../view-models/use-rail-width";

/**
 * The open panel's left edge: drag it towards the page to widen the panel,
 * back to narrow it. Arrow keys do the same; a double-click goes back to the
 * default width. A focusable separator, so the keyboard reaches it.
 */
export function RailResizeHandle({ vm, label }: Readonly<{ vm: RailWidthViewModel; label: string }>) {
  return (
    <div
      className="qa-rail__resize"
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label}`}
      title="Drag to resize · double-click to reset"
      tabIndex={0}
      data-active={String(vm.resizing)}
      {...vm.handle}
    />
  );
}
