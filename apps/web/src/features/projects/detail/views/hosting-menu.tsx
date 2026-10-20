"use client";

import { useId, useRef } from "react";

import { useMenuButton } from "@/features/checklists/studio";

export interface HostingMenuItem {
  /** Stable key and the item's text. */
  label: string;
  /** A second, quieter line under the label. */
  hint?: string;
  onSelect?: () => void;
  disabled?: boolean;
  /** Drawn in the danger colour: Detach, Remove. */
  destructive?: boolean;
}

function itemClassName(item: HostingMenuItem): string {
  return item.destructive ? "hosting-menu__item hosting-menu__item--danger" : "hosting-menu__item";
}

function MenuItemBody({ item }: Readonly<{ item: HostingMenuItem }>) {
  return (
    <>
      <span className="hosting-menu__label">{item.label}</span>
      {item.hint ? <span className="hosting-menu__hint">{item.hint}</span> : null}
    </>
  );
}

function MenuEntry({
  item,
  onClose,
}: Readonly<{ item: HostingMenuItem; onClose: (returnFocus: boolean) => void }>) {
  return (
    <button
      role="menuitem"
      type="button"
      tabIndex={-1}
      className={itemClassName(item)}
      aria-disabled={item.disabled || undefined}
      onClick={() => {
        if (item.disabled) return;
        onClose(true);
        item.onSelect?.();
      }}
    >
      <MenuItemBody item={item} />
    </button>
  );
}

/**
 * A "⋯" menu button (the WAI-ARIA menu-button pattern): the service header's
 * secondary actions and each variable row's. Renders nothing without items.
 */
export function HostingMenu({
  label,
  items,
}: Readonly<{ label: string; items: ReadonlyArray<HostingMenuItem> }>) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menu = useMenuButton({ triggerRef, menuRef });
  if (!items.length) return null;

  return (
    <div className="hosting-menu">
      <button
        ref={triggerRef}
        type="button"
        className="hosting-menu__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-controls={menu.open ? menuId : undefined}
        onClick={menu.toggle}
        onKeyDown={menu.onTriggerKeyDown}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {menu.open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className="hosting-menu__list"
          onKeyDown={menu.onMenuKeyDown}
        >
          {items.map((item) => (
            <MenuEntry key={item.label} item={item} onClose={menu.close} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
