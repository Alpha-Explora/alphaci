"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import {
  filterGroupsByName,
  initialActiveIndex,
  repositoryCountText,
  stepActiveIndex,
} from "../model/group-picker-rules";

export interface GroupPickerOption {
  id: string;
  name: string;
  repositoryCount: number;
}

interface GroupPickerProps {
  options: readonly GroupPickerOption[];
  selectedId: string | null;
  /** The trigger's text: the selected group's name, or a prompt when none. */
  label: string;
  /** Shown inside the popover in place of the list. */
  error?: string | null;
  onSelect: (groupId: string) => void;
}

function ChevronIcon() {
  return (
    <svg className="group-picker-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PickerMessage({
  error,
  empty,
}: Readonly<{ error?: string | null; empty: boolean }>) {
  if (error) {
    return (
      <p className="group-picker-empty" role="alert">
        {error}
      </p>
    );
  }
  if (!empty) return null;
  return (
    <p className="group-picker-empty" role="status">
      No groups match.
    </p>
  );
}

/**
 * The page's group dropdown. The trigger is the page heading's content; the
 * popover holds a search box (a combobox) that filters a listbox of groups.
 *
 * Keyboard: ArrowDown, Enter or Space on the trigger opens it. In the search
 * box, Up/Down move the highlighted option, Enter picks it, Escape closes and
 * returns focus to the trigger. Clicking outside or tabbing away closes it.
 */
export function GroupPicker({
  options,
  selectedId,
  label,
  error = null,
  onSelect,
}: Readonly<GroupPickerProps>) {
  const baseId = useId();
  const popoverId = `${baseId}-popover`;
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const visible = error ? [] : filterGroupsByName(options, query);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function openList() {
    setActiveIndex(initialActiveIndex(options, selectedId));
    setOpen(true);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    setQuery("");
    if (returnFocus) triggerRef.current?.focus();
  }

  function choose(groupId: string) {
    onSelect(groupId);
    close(true);
  }

  function changeQuery(next: string) {
    setQuery(next);
    setActiveIndex(initialActiveIndex(filterGroupsByName(options, next), selectedId));
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown" || open) return;
    event.preventDefault();
    openList();
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const moves: Record<string, 1 | -1> = { ArrowDown: 1, ArrowUp: -1 };
    if (event.key in moves) {
      event.preventDefault();
      setActiveIndex((current) => stepActiveIndex(current, moves[event.key], visible.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = visible[activeIndex];
      if (option) choose(option.id);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      close(false);
    }
  }

  return (
    <div className="group-picker" ref={rootRef} data-tour="projects-list">
      <h1 className="workflow-page-title group-picker-heading">
        <button
          ref={triggerRef}
          type="button"
          className="group-picker-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? popoverId : undefined}
          onClick={() => (open ? close(false) : openList())}
          onKeyDown={onTriggerKeyDown}
        >
          <span className="group-picker-label">{label}</span>
          <ChevronIcon />
        </button>
      </h1>
      {open ? (
        <div className="group-picker-popover" id={popoverId}>
          <input
            ref={inputRef}
            className="group-picker-search"
            type="search"
            role="combobox"
            aria-label="Search groups"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 && visible[activeIndex] ? optionId(activeIndex) : undefined}
            placeholder="Search groups..."
            autoComplete="off"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            onKeyDown={onSearchKeyDown}
          />
          <PickerMessage error={error} empty={visible.length === 0} />
          <ul className="group-picker-list" id={listboxId} role="listbox" aria-label="Groups">
            {visible.map((option, index) => (
              <li
                key={option.id}
                id={optionId(index)}
                role="option"
                aria-selected={option.id === selectedId}
                className={`group-picker-option${index === activeIndex ? " is-active" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option.id)}
              >
                <span className="group-picker-option-name">{option.name}</span>
                <span className="group-picker-option-meta">
                  {repositoryCountText(option.repositoryCount)}
                </span>
                <span className="group-picker-option-check">
                  {option.id === selectedId ? <CheckIcon /> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
