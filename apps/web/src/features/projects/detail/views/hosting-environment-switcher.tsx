"use client";

import { useRef, type KeyboardEvent } from "react";

import {
  nextTabIndex,
  type HostingEnvironment,
  type HostingEnvironmentKind,
} from "../model/hosting-environment-rules";
import { HostingDot } from "./hosting-status";

/** The id of an environment's tab; its panel is labelled by it. */
export function environmentTabId(idPrefix: string, kind: HostingEnvironmentKind): string {
  return `${idPrefix}-env-${kind}`;
}

export function environmentPanelId(idPrefix: string): string {
  return `${idPrefix}-env-panel`;
}

/**
 * Production, UAT and Previews as WAI-ARIA tabs: one tab stop (the selected
 * tab), arrow keys, Home and End move between them, and selection follows
 * focus. Each tab says its branch and state in a line under its name, with a
 * dot in the state's colour.
 */
export function HostingEnvironmentSwitcher({
  environments,
  selected,
  onSelect,
  idPrefix,
}: Readonly<{
  environments: ReadonlyArray<HostingEnvironment>;
  selected: HostingEnvironmentKind;
  onSelect: (kind: HostingEnvironmentKind) => void;
  idPrefix: string;
}>) {
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = nextTabIndex(event.key, index, environments.length);
    if (next === null) return;
    event.preventDefault();
    onSelect(environments[next].kind);
    tabs.current[next]?.focus();
  }

  return (
    <div className="hosting-envs" role="tablist" aria-label="Environments">
      {environments.map((environment, index) => {
        const isSelected = environment.kind === selected;
        return (
          <button
            key={environment.kind}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            id={environmentTabId(idPrefix, environment.kind)}
            type="button"
            role="tab"
            className="hosting-envs__tab"
            aria-selected={isSelected}
            aria-controls={environmentPanelId(idPrefix)}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(environment.kind)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span className="hosting-envs__name">
              <HostingDot tone={environment.tone} />
              {environmentTabName(environment)}
            </span>
            <span className="hosting-envs__sub">{environment.subLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

/** "Previews (2)"; the other two are their label. */
function environmentTabName(environment: HostingEnvironment): string {
  if (environment.kind !== "previews") return environment.label;
  return `${environment.label} (${environment.previewBranches.length})`;
}
