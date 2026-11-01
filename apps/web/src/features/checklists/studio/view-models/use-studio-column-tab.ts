"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import {
  resolveStudioColumnTab,
  STUDIO_COLUMN_TABS,
  studioColumnTabKey,
  type StudioColumnTab,
} from "../../model/playwright-tab-rules";
import { useRememberedChoice } from "./use-remembered-flag";

export interface StudioColumnTabViewModel {
  tab: StudioColumnTab;
  /** True once the Playwright tab has been shown: its extra reads wait for it. */
  playwrightOpened: boolean;
  select: (tab: StudioColumnTab) => void;
  /** Up / Down (the rail's tabs are stacked), or Left / Right, move between the tabs (and focus), wrapping; Home / End jump. */
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  /** Where each tab button registers, so arrow keys can focus it. */
  tabRef: (tab: StudioColumnTab) => (node: HTMLButtonElement | null) => void;
}

const STEPS: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1, ArrowRight: 1, ArrowLeft: -1 };

function keyTarget(key: string, current: StudioColumnTab): StudioColumnTab | null {
  if (key === "Home") return STUDIO_COLUMN_TABS[0];
  if (key === "End") return STUDIO_COLUMN_TABS[STUDIO_COLUMN_TABS.length - 1];
  const step = STEPS[key];
  if (!step) return null;
  const count = STUDIO_COLUMN_TABS.length;
  return STUDIO_COLUMN_TABS[(STUDIO_COLUMN_TABS.indexOf(current) + step + count) % count];
}

/**
 * The studio column's Checklist | Playwright tabs: which one shows,
 * remembered per viewer and per studio in this browser (storage is a
 * convenience — unreadable storage opens the Checklist), and the tablist's
 * arrow-key movement. Selection follows focus, as in the Project QA workspace.
 */
export function useStudioColumnTab(studio: "qa" | "po"): StudioColumnTabViewModel {
  const [tab, choose] = useRememberedChoice(studioColumnTabKey(studio), resolveStudioColumnTab);
  const [playwrightOpened, setPlaywrightOpened] = useState(tab === "playwright");
  const nodes = useRef<Partial<Record<StudioColumnTab, HTMLButtonElement | null>>>({});

  function select(next: StudioColumnTab) {
    if (next === "playwright") setPlaywrightOpened(true);
    if (next !== tab) choose(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const next = keyTarget(event.key, tab);
    if (!next) return;
    event.preventDefault();
    select(next);
    nodes.current[next]?.focus();
  }

  return {
    tab,
    playwrightOpened,
    select,
    onKeyDown,
    tabRef: (key) => (node) => {
      nodes.current[key] = node;
    },
  };
}
