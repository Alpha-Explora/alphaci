"use client";

import "./export-menu.css";

import { useId, useRef, type ReactNode } from "react";

import { useMenuButton } from "../view-models/use-menu-button";
import type { QaExportStatus, QaExportViewModel } from "../view-models/use-qa-export-view-model";
import {
  BracesIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DocumentIcon,
  ExportIcon,
} from "./studio-icons";

const TRIGGER_LABELS: Partial<Record<QaExportStatus, string>> = {
  copying: "Copying…",
  copied: "Copied",
  downloading: "Preparing…",
};

function MenuItemBody({
  icon,
  title,
  hint,
}: Readonly<{ icon: ReactNode; title: string; hint: string }>) {
  return (
    <>
      <span className="qa-export__item-icon">{icon}</span>
      <span className="qa-export__item-text">
        <span className="qa-export__item-title">{title}</span>
        <span className="qa-export__item-hint">{hint}</span>
      </span>
    </>
  );
}

/**
 * "Export report": a menu button (WAI-ARIA pattern) with the three exports.
 * Download PDF is a real link to the print page — a new tab opened from a
 * click is never popup-blocked — and the two fetch-based exports report back
 * through the status line below the run header.
 */
const DEFAULT_LABEL = "Export report";

/** What the trigger says: the action in progress, else the label it rests on. */
function triggerLabel(status: QaExportStatus, resting: string | undefined): string {
  return TRIGGER_LABELS[status] ?? resting ?? DEFAULT_LABEL;
}

export function ExportMenu({
  vm,
  label,
}: Readonly<{ vm: QaExportViewModel; /** What the trigger says at rest. */ label?: string }>) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menu = useMenuButton({ triggerRef, menuRef });
  const busy = vm.status === "copying" || vm.status === "downloading";
  const triggerText = triggerLabel(vm.status, label);

  function run(action: () => Promise<void>) {
    menu.close(true);
    void action();
  }

  return (
    <div className="qa-export">
      <button
        ref={triggerRef}
        type="button"
        className={`qa-export__trigger${vm.status === "copied" ? " qa-export__trigger--done" : ""}`}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-controls={menu.open ? menuId : undefined}
        aria-busy={busy || undefined}
        onClick={menu.toggle}
        onKeyDown={menu.onTriggerKeyDown}
      >
        {vm.status === "copied" ? <CheckIcon /> : <ExportIcon />}
        <span>{triggerText}</span>
        <ChevronDownIcon />
      </button>
      {menu.open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label ?? DEFAULT_LABEL}
          className="qa-export__menu"
          onKeyDown={menu.onMenuKeyDown}
        >
          <a
            role="menuitem"
            tabIndex={-1}
            className="qa-export__item"
            href={vm.pdfHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => menu.close(false)}
          >
            <MenuItemBody icon={<DocumentIcon />} title="Download PDF" hint="Opens the print view in a new tab" />
          </a>
          <button
            role="menuitem"
            type="button"
            tabIndex={-1}
            className="qa-export__item"
            aria-disabled={busy || undefined}
            onClick={() => run(vm.copyMarkdown)}
          >
            <MenuItemBody icon={<CopyIcon />} title="Copy PR Markdown" hint="GitHub-flavoured, to paste into a pull request" />
          </button>
          <button
            role="menuitem"
            type="button"
            tabIndex={-1}
            className="qa-export__item"
            aria-disabled={busy || undefined}
            onClick={() => run(vm.downloadJson)}
          >
            <MenuItemBody icon={<BracesIcon />} title="Download JSON" hint="The full report, schema qa-report/v1" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** What the last export did. Success is announced; a failure stays until dismissed. */
export function ExportStatus({ vm }: Readonly<{ vm: QaExportViewModel }>) {
  const failed = vm.status === "failed";
  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {vm.status === "copied" ? vm.message : ""}
      </p>
      {failed && vm.message ? (
        <div className="qa-export__error" role="alert">
          <p>{vm.message}</p>
          <button type="button" className="qa-export__dismiss" onClick={vm.dismiss}>
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  );
}
