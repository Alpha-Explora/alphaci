"use client";

import "./create-project-menu.css";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { nextMenuIndex } from "../model/current-projects-rules";
import { FolderPlusIcon, MoreIcon, PlusIcon, RepoPlusIcon } from "./studio-icons";

interface MenuItem {
  id: "empty-project" | "add-repository";
  label: string;
  hint: string;
  /** A button item runs this; a link item navigates to `href`. */
  onSelect?: () => void;
  href?: string;
}

export interface CreateProjectActionsProps {
  /** The provisioning wizard (lead/admin, or a guest sent to sign up); null hides it. */
  onCreateProject: (() => void) | null;
  /** The Empty project dialog; null when the caller may not create one. */
  onCreateEmptyProject: (() => void) | null;
  /** The create-repository wizard for this team; null below Team lead. */
  addRepositoryHref: string | null;
}

function menuItems({
  onCreateEmptyProject,
  addRepositoryHref,
}: CreateProjectActionsProps): MenuItem[] {
  const items: MenuItem[] = [];
  if (onCreateEmptyProject) {
    items.push({
      id: "empty-project",
      label: "Empty project",
      hint: "A Project with no repositories yet",
      onSelect: onCreateEmptyProject,
    });
  }
  if (addRepositoryHref) {
    items.push({
      id: "add-repository",
      label: "Add repository",
      hint: "One repository, filed in this team",
      href: addRepositoryHref,
    });
  }
  return items;
}

/**
 * The Projects page's create actions: ONE primary "Create project" (the
 * provisioning wizard) and, beside it, a "⋯" menu with the other two ways in —
 * an Empty project, or a single repository. They used to be three buttons in
 * two rows (the page heading, and the Projects section head below it).
 *
 * The menu follows the WAI-ARIA menu-button pattern: the trigger says it has a
 * popup and whether it is open; Enter, Space or ArrowDown open it on the first
 * item and ArrowUp on the last; arrows wrap, Home/End jump; Escape closes it
 * and hands focus back to the trigger; Tab or a click outside closes it.
 */
export function CreateProjectActions(props: Readonly<CreateProjectActionsProps>) {
  const items = menuItems(props);
  if (!props.onCreateProject && items.length === 0) return null;
  return (
    <div className="create-project-actions">
      {props.onCreateProject ? (
        <button
          type="button"
          className="primary-button"
          data-testid="create-project-button"
          onClick={props.onCreateProject}
        >
          <PlusIcon />
          Create project
        </button>
      ) : null}
      {items.length > 0 ? <CreateMoreMenu items={items} /> : null}
    </div>
  );
}

function CreateMoreMenu({ items }: Readonly<{ items: MenuItem[] }>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const menuId = useId();
  const triggerId = useId();

  // Focus follows the active item while the menu is open.
  useEffect(() => {
    if (open && activeIndex >= 0) itemRefs.current[activeIndex]?.focus();
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

  function openAt(index: number) {
    setOpen(true);
    setActiveIndex(index);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    setActiveIndex(-1);
    if (returnFocus) triggerRef.current?.focus();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openAt(0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openAt(items.length - 1);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      close(true);
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      close(false);
      return;
    }
    // Space activates a menu item; a link would otherwise scroll the page.
    if (event.key === " " && items[activeIndex]?.href) {
      event.preventDefault();
      itemRefs.current[activeIndex]?.click();
      return;
    }
    const next = nextMenuIndex(event.key, activeIndex, items.length);
    if (next !== null) {
      event.preventDefault();
      setActiveIndex(next);
    }
  }

  function choose(item: MenuItem) {
    close(false);
    item.onSelect?.();
  }

  return (
    <div className="create-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className="ghost-button create-menu-trigger"
        aria-label="More ways to create"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-testid="create-menu-button"
        onClick={() => (open ? close(false) : openAt(0))}
        onKeyDown={onTriggerKeyDown}
      >
        <MoreIcon />
      </button>
      {open ? (
        <ul
          className="create-menu-popover"
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item, index) => (
            <li key={item.id} role="none">
              <CreateMenuItem
                item={item}
                active={index === activeIndex}
                itemRef={(element) => {
                  itemRefs.current[index] = element;
                }}
                onHover={() => setActiveIndex(index)}
                onChoose={() => choose(item)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CreateMenuItem({
  item,
  active,
  itemRef,
  onHover,
  onChoose,
}: Readonly<{
  item: MenuItem;
  active: boolean;
  itemRef: (element: HTMLElement | null) => void;
  onHover: () => void;
  onChoose: () => void;
}>) {
  const body = (
    <>
      <span className="create-menu-icon">
        {item.id === "empty-project" ? <FolderPlusIcon /> : <RepoPlusIcon />}
      </span>
      <span className="create-menu-text">
        <span className="create-menu-label">{item.label}</span>
        <span className="create-menu-hint">{item.hint}</span>
      </span>
    </>
  );
  const className = `create-menu-item${active ? " is-active" : ""}`;
  if (item.href) {
    return (
      <Link
        ref={itemRef}
        href={item.href}
        role="menuitem"
        tabIndex={-1}
        className={className}
        onPointerEnter={onHover}
        onClick={onChoose}
      >
        {body}
      </Link>
    );
  }
  return (
    <button
      ref={itemRef}
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={className}
      onPointerEnter={onHover}
      onClick={onChoose}
    >
      {body}
    </button>
  );
}
