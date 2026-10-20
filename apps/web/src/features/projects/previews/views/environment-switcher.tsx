"use client";

import { useRef, type KeyboardEvent } from "react";

import {
  environmentName,
  environmentTabLine,
  nextTabIndex,
  previewKey,
  previewStatusTone,
} from "../../model/projects-rules";
import type { ProjectBranchPreview } from "../../model/projects-types";

export function environmentTabId(idPrefix: string, key: string): string {
  return `${idPrefix}-tab-${key.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

/**
 * Production and UAT as WAI-ARIA tabs above the one card that shows: one tab
 * stop (the selected tab), arrow keys, Home and End move between them, and
 * selection follows focus. Each tab says its branch and state under its name.
 */
export function EnvironmentSwitcher({
  environments,
  selected,
  onSelect,
  idPrefix,
  panelId,
}: Readonly<{
  environments: ReadonlyArray<ProjectBranchPreview>;
  selected: string;
  onSelect: (key: string) => void;
  idPrefix: string;
  panelId: string;
}>) {
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = nextTabIndex(event.key, index, environments.length);
    if (next === null) return;
    event.preventDefault();
    const target = environments[next];
    if (!target) return;
    onSelect(previewKey(target));
    tabs.current[next]?.focus();
  }

  return (
    <div aria-label="Environments" className="deploy-envs" role="tablist">
      {environments.map((preview, index) => {
        const key = previewKey(preview);
        const isSelected = key === selected;
        return (
          <button
            aria-controls={panelId}
            aria-selected={isSelected}
            className="deploy-envs__tab"
            id={environmentTabId(idPrefix, key)}
            key={key}
            onClick={() => onSelect(key)}
            onKeyDown={(event) => onKeyDown(event, index)}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            role="tab"
            tabIndex={isSelected ? 0 : -1}
            type="button"
          >
            <span className="deploy-envs__name">
              <span
                aria-hidden="true"
                className={`deploy-card__dot deploy-card__dot--${previewStatusTone(preview.status)}`}
              />
              {environmentName(preview)}
            </span>
            <span className="deploy-envs__line">{environmentTabLine(preview)}</span>
          </button>
        );
      })}
    </div>
  );
}
