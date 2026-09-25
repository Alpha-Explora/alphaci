"use client";

import { useEffect, useRef } from "react";

import { revealScrollDelta } from "../../model/side-tab-scroll";

/**
 * A vertical, grouped tab rail — the side-panel form of a tab strip.
 *
 * A sibling of the horizontal tabs rather than a mode of them, because both
 * contracts differ: the keyboard ring is Up/Down instead of Left/Right, and the
 * caller has to place this BESIDE its panel where a strip merely sits above it.
 *
 * WHY GROUPS. A flat list of five is a list; the headings turn it into a map of
 * what the thing HAS — the team itself, its people, its work, its records, its
 * configuration. That reading survives the list growing, which a flat one does
 * not.
 *
 * WHY THE SELECTED CHIP IS SOLID. The rail carries its own surface, so a tinted
 * chip on it disappears. The open section is drawn in solid brand instead.
 *
 * Two deliberate ARIA choices:
 *  - `aria-orientation="vertical"` with Up/Down. The tabs pattern binds arrows
 *    to the visual axis, so a vertical list answering to Left/Right would
 *    announce one thing and do another.
 *  - Group headings sit INSIDE the tablist as `role="presentation"`. A tablist
 *    may only own tabs, so they are hidden from the accessibility tree — they
 *    are a visual grouping of controls that already name themselves. This keeps
 *    one ring of arrow navigation across every group.
 *
 * Presentational only: the caller owns the selection.
 */
export interface SideTabItem<T extends string> {
  id: T;
  label: string;
  /** Optional trailing count, e.g. the number of members. */
  badge?: number;
}

export interface SideTabGroup<T extends string> {
  /** Small uppercase heading. Omit for an ungrouped run. */
  heading?: string;
  items: ReadonlyArray<SideTabItem<T>>;
}

export function SideTabs<T extends string>({
  groups,
  value,
  onChange,
  label,
  idPrefix,
  footer,
}: Readonly<{
  groups: ReadonlyArray<SideTabGroup<T>>;
  value: T;
  onChange: (id: T) => void;
  /** Names the tablist for screen readers, e.g. "Team sections". */
  label: string;
  /** Prefix for the generated tab/panel ids — must match the panels' own. */
  idPrefix: string;
  /** Parked at the foot of the rail, below the groups and outside the tablist. */
  footer?: React.ReactNode;
}>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const listRef = useRef<HTMLDivElement | null>(null);

  // Below the tablet breakpoint the rail is a horizontally scrolling row.
  // Keep the open section in view there; only the strip's own scrollLeft
  // moves, so the page never jumps. A no-op while the rail is vertical.
  useEffect(() => {
    const list = listRef.current;
    const item = refs.current[value];
    if (!list || !item || list.scrollWidth <= list.clientWidth) return;
    const delta = revealScrollDelta(
      list.getBoundingClientRect(),
      item.getBoundingClientRect(),
    );
    if (delta !== 0) list.scrollLeft += delta;
  }, [value]);

  // Flattened per render: arrows cross group boundaries, so the ring is over
  // every item rather than over each group separately.
  const flat = groups.flatMap((group) => group.items);

  function handleKeyDown(event: React.KeyboardEvent) {
    const delta =
      event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    let next: SideTabItem<T> | undefined;

    if (delta !== 0) {
      const at = flat.findIndex((item) => item.id === value);
      // Wrap: the ARIA pattern expects a ring, not a dead end.
      next = flat[(at + delta + flat.length) % flat.length];
    } else if (event.key === "Home") {
      next = flat[0];
    } else if (event.key === "End") {
      next = flat[flat.length - 1];
    }
    if (!next) return;

    event.preventDefault();
    onChange(next.id);
    // Follow-focus: with automatic activation the focused tab IS the selected
    // one, so focus must move with it or the next arrow press would resume
    // from the old tab.
    refs.current[next.id]?.focus();
  }

  return (
    <div className="side-tabs">
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="vertical"
        onKeyDown={handleKeyDown}
        ref={listRef}
        className="side-tabs-list"
      >
        {groups.map((group, groupIndex) => (
          <div
            key={group.heading ?? `group-${String(groupIndex)}`}
            role="presentation"
            className="side-tabs-group"
          >
            {group.heading ? (
              <p role="presentation" className="side-tabs-heading">
                {group.heading}
              </p>
            ) : null}
            {group.items.map((item) => {
              const selected = item.id === value;
              return (
                <button
                  key={item.id}
                  ref={(element) => {
                    refs.current[item.id] = element;
                  }}
                  type="button"
                  role="tab"
                  id={`${idPrefix}-tab-${item.id}`}
                  aria-selected={selected}
                  aria-controls={`${idPrefix}-panel-${item.id}`}
                  // Only the selected tab is reachable by Tab; arrows do the rest.
                  tabIndex={selected ? 0 : -1}
                  onClick={() => onChange(item.id)}
                  className={`side-tab${selected ? " side-tab--selected" : ""}`}
                >
                  <span className="side-tab-label">{item.label}</span>
                  {item.badge !== undefined ? (
                    <span className="side-tab-badge">{item.badge}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {footer ? <div className="side-tabs-footer">{footer}</div> : null}
    </div>
  );
}
