"use client";

import { useEffect, useRef } from "react";

import type { SideTabGroup } from "@/features/groups/workspace";

/**
 * The project's sections, as a strip across the top of the page.
 *
 * A sibling of SideTabs rather than a mode of it, for the same reason SideTabs
 * is a sibling of the horizontal tabs: the contracts differ. The keyboard ring
 * is Left/Right instead of Up/Down, and the caller places this ABOVE its panel
 * where the rail sits beside one. Teams keeps the rail; only this page moved.
 *
 * WHY THE GROUPS SURVIVE WITHOUT THEIR HEADINGS. The rail could afford a
 * heading per group because vertical space was free; a strip cannot without
 * becoming two rows tall. The clusters are drawn with a rule between them
 * instead, so "what this project HAS" still reads as four kinds of thing
 * rather than nine flat entries, at one row's cost.
 *
 * WHY IT SCROLLS RATHER THAN WRAPS. Nine entries do not fit a narrow window.
 * Wrapping would change the bar's height with the viewport and push the panel
 * down by a row at some widths; scrolling keeps the page still. The selected
 * tab is scrolled back into view, because selection can move by keyboard to a
 * tab that is off-screen.
 *
 * Presentational only: the caller owns the selection.
 */
export function ProjectDetailTopTabs<T extends string>({
  groups,
  value,
  onChange,
  label,
  idPrefix,
}: Readonly<{
  groups: ReadonlyArray<SideTabGroup<T>>;
  value: T;
  onChange: (id: T) => void;
  /** Names the tablist for screen readers, e.g. "Project sections". */
  label: string;
  /** Prefix for the generated tab/panel ids — must match the panels' own. */
  idPrefix: string;
}>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Flattened per render: arrows cross group boundaries, so the ring is over
  // every item rather than over each group separately.
  const flat = groups.flatMap((group) => group.items);

  useEffect(() => {
    // `nearest` in both axes: bring the tab into the strip without scrolling
    // the page itself. Optional call because jsdom has no implementation.
    refs.current[value]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [value]);

  function handleKeyDown(event: React.KeyboardEvent) {
    const delta =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    let next: SideTabGroup<T>["items"][number] | undefined;

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
    <div className="project-tabs">
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="horizontal"
        onKeyDown={handleKeyDown}
        className="project-tabs__list"
      >
        {groups.map((group, groupIndex) => (
          <div
            key={group.heading ?? `group-${String(groupIndex)}`}
            role="presentation"
            className="project-tabs__group"
          >
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
                  className={`project-tab${selected ? " project-tab--selected" : ""}`}
                >
                  <span className="project-tab__label">{item.label}</span>
                  {item.badge !== undefined ? (
                    <span className="project-tab__badge">{item.badge}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
