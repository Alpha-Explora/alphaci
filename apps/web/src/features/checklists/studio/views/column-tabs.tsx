"use client";

import "./playwright.css";

import type { ReactNode } from "react";

import type { PlaywrightTabStatus, StudioColumnTab } from "../../model/playwright-tab-rules";
import type { StudioColumnTabViewModel } from "../view-models/use-studio-column-tab";

const LABELS: Record<StudioColumnTab, string> = { checklist: "Checklist", playwright: "Playwright" };

/** The ids that tie each tab to its panel. */
export function columnTabIds(baseId: string, tab: StudioColumnTab): { tab: string; panel: string } {
  return { tab: `${baseId}-coltab-${tab}`, panel: `${baseId}-colpanel-${tab}` };
}

/** "· 22/24" beside Playwright, spoken in words; nothing when nothing reported. */
function TabStatus({ status }: Readonly<{ status: PlaywrightTabStatus }>) {
  if (!status.text) return null;
  return (
    <>
      <span className="qa-coltab__status" data-tone={status.tone} aria-hidden="true">
        <span className="qa-coltab__sep">·</span>
        {status.text}
      </span>
      <span className="sr-only">{`, ${status.spoken ?? status.text}`}</span>
    </>
  );
}

/**
 * The run column's tab bar: the tabs, then `status` (the "Ready for
 * production" chip) at the end of their row, then `action` ("Merge to main").
 * Narrow, the action wraps to a second line of the bar. Only the tabs are in
 * the tablist; the rest sit beside it. Without tabs (`tabs={false}`, a Team
 * lead's PO Studio) the chip and the action share one row.
 */
export function ColumnBar({
  children,
  status,
  action,
  tabs = true,
}: Readonly<{ children?: ReactNode; status?: ReactNode; action?: ReactNode; tabs?: boolean }>) {
  return (
    <div className="qa-coltabs-bar" data-tabs={tabs ? "true" : "false"}>
      <div className="qa-coltabs-bar__main">
        {children}
        {status}
      </div>
      <div className="qa-coltabs-bar__action">{action}</div>
    </div>
  );
}

/**
 * Checklist | Playwright, at the top of the run column. Proper tabs: one tab
 * stop (the selected tab), Left / Right / Home / End move and select, and the
 * Playwright label carries the latest verify verdict.
 */
export function ColumnTabs({
  vm,
  baseId,
  status,
  label,
}: Readonly<{ vm: StudioColumnTabViewModel; baseId: string; status: PlaywrightTabStatus; label: string }>) {
  return (
    <div className="qa-coltabs" role="tablist" aria-label={label}>
      {(Object.keys(LABELS) as StudioColumnTab[]).map((tab) => {
        const ids = columnTabIds(baseId, tab);
        const selected = vm.tab === tab;
        return (
          <button
            key={tab}
            ref={vm.tabRef(tab)}
            type="button"
            role="tab"
            id={ids.tab}
            aria-selected={selected}
            aria-controls={ids.panel}
            tabIndex={selected ? 0 : -1}
            className="qa-coltab"
            data-tab={tab}
            onClick={() => vm.select(tab)}
            onKeyDown={vm.onKeyDown}
          >
            {LABELS[tab]}
            {tab === "playwright" ? <TabStatus status={status} /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** One tab's panel. Both stay mounted; the hidden one keeps its drafts, dialogs and polling. */
export function ColumnTabPanel({
  baseId,
  tab,
  selected,
  children,
}: Readonly<{ baseId: string; tab: StudioColumnTab; selected: boolean; children: ReactNode }>) {
  const ids = columnTabIds(baseId, tab);
  return (
    <div
      role="tabpanel"
      id={ids.panel}
      aria-labelledby={ids.tab}
      className="qa-colpanel"
      data-tab={tab}
      hidden={!selected}
    >
      {children}
    </div>
  );
}
