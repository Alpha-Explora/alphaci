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
  panelTabAction,
  OWN_TEAMS_HEADING,
  switcherOptionGroups,
  switcherPanelShift,
} from "../model/workspace-switcher-rules";
import type { WorkspaceSummary } from "../model/workspace-types";

export interface WorkspacePickerProps {
  /** The caller's own teams. */
  items: readonly WorkspaceSummary[];
  /** A platform admin's non-member teams; empty for everybody else. */
  otherTeams: readonly WorkspaceSummary[];
  /** The team on screen, or null before one resolves. */
  current: WorkspaceSummary | null;
  /** Offer the "Create workspace" button in the heading row (Team leads and Admins). */
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

export function PlusIcon() {
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
 * The header's team picker: a button that opens a listbox of teams under one
 * "Your teams" heading, with a compact "+" (Create workspace) button at the right
 * end of that heading for the people who may create one.
 *
 * It replaced a native <select>, whose create entry had to ride in as a fake
 * option behind a disabled "──────" divider option — it read as a broken list.
 *
 * Keyboard (WAI-ARIA listbox popup): Enter, Space or ArrowDown on the button
 * open the panel on the current team, ArrowUp on the last one; arrows move
 * between the teams, wrapping (the heading is never a stop); Home/End jump;
 * Enter or Space picks; Tab from the list moves to the "+" button (Enter or
 * Space activates it), and Tab from there closes the panel; Escape closes
 * and hands focus back to the button; a press outside closes it.
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
  const createRef = useRef<HTMLButtonElement>(null);
  const stopRefs = useRef<Array<HTMLElement | null>>([]);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const prefixId = `${baseId}-prefix`;
  const nameId = `${baseId}-name`;

  const groups = switcherOptionGroups(items, otherTeams);
  const options = flattenSwitcherOptions(groups);
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

  function onTab(event: KeyboardEvent<HTMLDivElement>, onCreateButton: boolean) {
    const action = panelTabAction(event.shiftKey, onCreateButton, canCreate);
    if (action === "close") {
      // Not prevented: with focus back on the button, Tab moves on from it.
      close(true);
      return;
    }
    event.preventDefault();
    const target = action === "to-create" ? createRef.current : stopRefs.current[Math.max(activeIndex, 0)];
    target?.focus();
  }

  function onPanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const onCreateButton = event.target === createRef.current;
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      onTab(event, onCreateButton);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      // On the "+" button these are its own native click.
      if (!onCreateButton) {
        event.preventDefault();
        if (activeIndex >= 0 && activeIndex < options.length) choose(options[activeIndex]);
      }
      return;
    }
    const next = nextSwitcherIndex(event.key, activeIndex, options.length);
    if (next !== null) {
      event.preventDefault();
      setActiveIndex(next);
    }
  }

  // Teams never repeat across the merged list, so an id names one stop.
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
          <div className="team-switcher-heading-row">
            <div className="team-switcher-group-label">
              {OWN_TEAMS_HEADING}
            </div>
            {canCreate ? (
              <button
                ref={createRef}
                type="button"
                className="team-switcher-add"
                aria-label="Create workspace"
                title="Create workspace"
                data-testid="workspace-switcher-create"
                onClick={create}
              >
                <PlusIcon />
              </button>
            ) : null}
          </div>
          <div
            id={listboxId}
            role="listbox"
            aria-label="Active workspace"
            className="team-switcher-listbox"
          >
            {options.map(renderOption)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
