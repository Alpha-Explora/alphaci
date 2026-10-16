"use client";

import "./playwright.css";

import type { ReactNode } from "react";

import type { PlaywrightTabStatus, StudioColumnTab } from "../../model/playwright-tab-rules";
import type { AutomationSignal } from "../../model/qa-studio-rules";
import type { StudioColumnTabViewModel } from "../view-models/use-studio-column-tab";
import { ChecklistIcon, FlaskIcon } from "./studio-icons";

const LABELS: Record<StudioColumnTab, string> = { checklist: "Checklist", playwright: "Playwright" };

/** The ids that tie each tab to its panel. */
export function columnTabIds(baseId: string, tab: StudioColumnTab): { tab: string; panel: string } {
  return { tab: `${baseId}-coltab-${tab}`, panel: `${baseId}-colpanel-${tab}` };
}

/** What each rail tab carries under its icon: the checklist's "0/3", Playwright's "22/24". */
export interface ColumnTabBadges {
  /** The run's "passed/total", or null before a run exists. */
  checklist: { text: string | null; spoken: string | null; title: string };
  playwright: { status: PlaywrightTabStatus; signal: AutomationSignal };
}

/** "22/24" under an icon, spoken in words; nothing when nothing reported. */
function TabStatus({
  text,
  spoken,
  tone = "none",
}: Readonly<{ text: string | null; spoken: string | null; tone?: string }>) {
  if (!text) return null;
  return (
    <>
      <span className="qa-coltab__status" data-tone={tone} aria-hidden="true">
        {text}
      </span>
      <span className="sr-only">{`, ${spoken ?? text}`}</span>
    </>
  );
}

/**
 * The panel header's end: `status` (the "Ready for production" chip), then
 * `action` ("Merge to main"). The tabs live on the rail strip, so this is
 * only ever the chip and the action, sharing the header row with the title.
 */
export function ColumnBar({
  status,
  action,
}: Readonly<{ status?: ReactNode; action?: ReactNode }>) {
  return (
    <div className="qa-coltabs-bar">
      <div className="qa-coltabs-bar__main">{status}</div>
      <div className="qa-coltabs-bar__action">{action}</div>
    </div>
  );
}

/**
 * Checklist and Playwright, stacked on the run rail's strip: an icon each,
 * the checklist's progress under its icon and the latest verify verdict
 * (with the CI dot) under Playwright's. Proper tabs: one tab stop (the
 * selected tab), Up / Down (and Left / Right) / Home / End move and select.
 * Choosing one also lifts an unpin's hover suppression (`onChoose`), so the
 * panel opens under the pointer that chose it.
 */
export function ColumnTabs({
  vm,
  baseId,
  badges,
  label,
  onChoose,
}: Readonly<{
  vm: StudioColumnTabViewModel;
  baseId: string;
  badges: ColumnTabBadges;
  label: string;
  onChoose?: () => void;
}>) {
  return (
    <div className="qa-coltabs" role="tablist" aria-label={label} aria-orientation="vertical">
      {(Object.keys(LABELS) as StudioColumnTab[]).map((tab) => {
        const ids = columnTabIds(baseId, tab);
        const selected = vm.tab === tab;
        const playwright = tab === "playwright";
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
            title={playwright ? playwrightTitle(badges.playwright) : badges.checklist.title}
            onClick={() => {
              vm.select(tab);
              onChoose?.();
            }}
            onKeyDown={vm.onKeyDown}
          >
            <span className="qa-coltab__icon">
              {playwright ? <FlaskIcon /> : <ChecklistIcon />}
              {playwright ? (
                <span className="qa-rail__dot" data-tone={badges.playwright.signal.tone} aria-hidden="true" />
              ) : null}
            </span>
            <span className="sr-only">{LABELS[tab]}</span>
            {playwright ? (
              <>
                <TabStatus
                  text={badges.playwright.status.text}
                  spoken={badges.playwright.status.spoken}
                  tone={badges.playwright.status.tone}
                />
                <span className="sr-only">{`. ${badges.playwright.signal.label}`}</span>
              </>
            ) : (
              <TabStatus text={badges.checklist.text} spoken={badges.checklist.spoken} />
            )}
          </button>
        );
      })}
    </div>
  );
}

function playwrightTitle(badge: ColumnTabBadges["playwright"]): string {
  const status = badge.status.spoken ?? badge.status.text;
  return status ? `Playwright · ${status}` : "Playwright";
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
