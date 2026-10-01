"use client";

import "./workspace-picker.css";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import {
  flattenSwitcherOptions,
  nextSwitcherIndex,
  openingSwitcherIndex,
  switcherOptionGroups,
  switcherPanelShift,
  type SwitcherOptionGroup,
} from "../model/workspace-switcher-rules";
import type { WorkspaceSummary } from "../model/workspace-types";

export interface WorkspacePickerProps {
  /** The caller's own teams. */
  items: readonly WorkspaceSummary[];
  /** A platform admin's non-member teams; empty for everybody else. */
  otherTeams: readonly WorkspaceSummary[];
  /** The team on screen, or null before one resolves. */
  current: WorkspaceSummary | null;
  /** Offer "Create workspace" after the list (Team leads and Admins). */
  canCreate: boolean;
  onSelect: (workspaceId: string) => void;
  onCreate: () => void;
}

function ChevronIcon() {
  return (
    <svg
      className="team-switcher-chevron"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/**
 * The header's team picker: a button that opens a listbox of teams, and a
 * "Create workspace" action under it for the people who may create one.
 *
 * It replaced a native <select>, whose create entry had to ride in as a fake
 * option behind a disabled "──────" divider option — it read as a broken list.
 *
 * Keyboard (WAI-ARIA listbox popup): Enter, Space or ArrowDown on the button
 * open the panel on the current team, ArrowUp on the last one; arrows move
 * between the teams and then the action, wrapping (group headings are never a
 * stop); Home/End jump; Enter or Space picks; Escape closes and hands focus
 * back to the button; Tab or a press outside closes it.
 */
export function WorkspacePicker({
  items,
  otherTeams,
  current,
  canCreate,
  onSelect,
  onCreate,
}: Readonly<WorkspacePickerProps>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const stopRefs = useRef<Array<HTMLElement | null>>([]);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const prefixId = `${baseId}-prefix`;
  const nameId = `${baseId}-name`;

  const groups = switcherOptionGroups(items, otherTeams);
  const options = flattenSwitcherOptions(groups);
  // Every keyboard stop: the options, then the action when it is offered.
  const stopCount = options.length + (canCreate ? 1 : 0);
  const currentId = current?.id ?? null;
  const currentName = current?.name ?? "Choose a team";

  // Focus follows the active stop while the panel is open.
  useEffect(() => {
    if (open && activeIndex >= 0) stopRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  // A press anywhere outside closes it, without stealing that press's focus.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the panel on screen: on a phone the trigger sits mid-header and a
  // wide panel would run off the right edge. Written straight to the element
  // (a custom property), so measuring never costs a second render.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    function place() {
      if (!panel) return;
      panel.style.setProperty("--team-switcher-shift", "0px");
      // The layout width, not the rect's: the entry animation starts at
      // scale(0.98), which would under-measure the panel by a few pixels.
      const left = panel.getBoundingClientRect().left;
      const shift = switcherPanelShift(
        left,
        left + panel.offsetWidth,
        document.documentElement.clientWidth,
      );
      panel.style.setProperty("--team-switcher-shift", `${shift}px`);
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  function openAt(index: number) {
    setOpen(true);
    setActiveIndex(index);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    setActiveIndex(-1);
    if (returnFocus) triggerRef.current?.focus();
  }

  function choose(option: WorkspaceSummary) {
    close(true);
    if (option.id !== currentId) onSelect(option.id);
  }

  function create() {
    // Focus goes back to the trigger first, so the dialog hands it back there
    // when it closes instead of to a menu row that no longer exists.
    close(true);
    onCreate();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openAt(openingSwitcherIndex(options, currentId));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openAt(Math.max(options.length - 1, 0));
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      close(true);
    }
  }

  function onPanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      // Not prevented: with focus back on the button, Tab moves on from it.
      close(true);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (activeIndex >= 0 && activeIndex < options.length) choose(options[activeIndex]);
      else if (canCreate && activeIndex === options.length) create();
      return;
    }
    const next = nextSwitcherIndex(event.key, activeIndex, stopCount);
    if (next !== null) {
      event.preventDefault();
      setActiveIndex(next);
    }
  }

  // Own and other teams never overlap, so an id names one stop.
  const optionIndexById = new Map(options.map((option, index) => [option.id, index]));
  function renderOption(option: WorkspaceSummary) {
    const index = optionIndexById.get(option.id) ?? -1;
    const selected = option.id === currentId;
    const active = index === activeIndex;
    return (
      <div
        key={option.id}
        ref={(element) => {
          stopRefs.current[index] = element;
        }}
        id={`${baseId}-option-${index}`}
        role="option"
        aria-selected={selected}
        tabIndex={-1}
        title={option.name}
        className={`team-switcher-option${active ? " is-active" : ""}${selected ? " is-selected" : ""}`}
        onPointerEnter={() => setActiveIndex(index)}
        onClick={() => choose(option)}
      >
        <span className="team-switcher-option-name">{option.name}</span>
        <span className="team-switcher-option-check">{selected ? <CheckIcon /> : null}</span>
      </div>
    );
  }

  function renderGroup(group: SwitcherOptionGroup) {
    if (!group.label) return group.options.map(renderOption);
    const labelId = `${baseId}-group-${group.key}`;
    return (
      <div key={group.key} role="group" aria-labelledby={labelId} className="team-switcher-group">
        <div id={labelId} role="presentation" className="team-switcher-group-label">
          {group.label}
        </div>
        {group.options.map(renderOption)}
      </div>
    );
  }

  const actionIndex = options.length;

  return (
    <div className="team-switcher team-switcher--picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="team-switcher-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-labelledby={`${prefixId} ${nameId}`}
        title={currentName}
        data-testid="workspace-switcher-trigger"
        onClick={() => (open ? close(false) : openAt(openingSwitcherIndex(options, currentId)))}
        onKeyDown={onTriggerKeyDown}
      >
        <span id={prefixId} className="sr-only">
          Active workspace:
        </span>
        <span id={nameId} className="team-switcher-trigger-label">
          {currentName}
        </span>
        <ChevronIcon />
      </button>
      {open ? (
        <div
          ref={panelRef}
          className="team-switcher-panel"
          data-testid="workspace-switcher-panel"
          onKeyDown={onPanelKeyDown}
        >
          <div
            id={listboxId}
            role="listbox"
            aria-label="Active workspace"
            className="team-switcher-listbox"
          >
            {groups.map(renderGroup)}
          </div>
          {canCreate ? (
            <>
              <div className="team-switcher-divider" role="separator" />
              <button
                ref={(element) => {
                  stopRefs.current[actionIndex] = element;
                }}
                type="button"
                tabIndex={-1}
                className={`team-switcher-action${activeIndex === actionIndex ? " is-active" : ""}`}
                data-testid="workspace-switcher-create"
                onPointerEnter={() => setActiveIndex(actionIndex)}
                onClick={create}
              >
                <span className="team-switcher-action-icon">
                  <PlusIcon />
                </span>
                Create workspace
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
