"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type KeyboardEvent } from "react";

import type { ProjectDetailTab } from "../model/project-detail-tab-rules";
import { nextEnabledIndex, switchHref, UNLINKED_REPO_HINT } from "../model/project-folder-rules";
import type { RepoSwitchOption } from "../model/project-folder-types";

const KEY_STEPS: Readonly<Record<string, 1 | -1>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/** The option that holds the group's single tab stop. */
function tabStopIndex(options: ReadonlyArray<RepoSwitchOption>): number {
  const current = options.findIndex((option) => option.current);
  if (current >= 0) return current;
  return options.findIndex((option) => !option.disabled);
}

/** The data attributes the styles read: role colour, name shown, opening. */
function optionData(option: RepoSwitchOption, pendingId: string | null) {
  return {
    "data-role": option.role ?? undefined,
    "data-show-name": option.showName || undefined,
    "data-pending":
      (!option.current && pendingId !== null && option.projectId === pendingId) || undefined,
  };
}

/**
 * The segmented switch between a Project's repositories.
 *
 * A radio group — one repository is the page on screen — with a roving tab
 * stop and arrow-key movement. Arrows move focus only; Enter, Space or a click
 * opens the repository. Following the radio pattern to the letter (arrows also
 * select) would load a page per keystroke while the viewer is still reading
 * the options.
 *
 * Opening keeps the viewer's tab: Hosting on the frontend opens Hosting on the
 * backend, or Overview when the target does not show that tab.
 */
export function ProjectRepoSwitch({
  options,
  projectName,
  currentTab,
  visibleTabs,
}: Readonly<{
  options: ReadonlyArray<RepoSwitchOption>;
  projectName: string;
  currentTab: ProjectDetailTab;
  visibleTabs: ReadonlyArray<ProjectDetailTab>;
}>) {
  const router = useRouter();
  const hintId = useId();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const [focused, setFocused] = useState<number | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const stop = focused !== null && options[focused] && !options[focused].disabled
    ? focused
    : tabStopIndex(options);

  function open(option: RepoSwitchOption) {
    if (option.disabled || option.current || !option.projectId) return;
    setPendingId(option.projectId);
    router.push(switchHref(option.projectId, `#${currentTab}`, visibleTabs));
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | null = null;
    const step = KEY_STEPS[event.key];
    if (step) next = nextEnabledIndex(options, index, step);
    else if (event.key === "Home") next = nextEnabledIndex(options, -1, 1);
    else if (event.key === "End") next = nextEnabledIndex(options, options.length, -1);
    if (next === null) return;
    event.preventDefault();
    setFocused(next);
    buttons.current[next]?.focus();
  }

  const anyDisabled = options.some((option) => option.disabled);

  return (
    <>
      <div
        className="repo-switch"
        role="radiogroup"
        aria-label={`Repositories in ${projectName}`}
        aria-busy={pendingId !== null || undefined}
      >
        {options.map((option, index) => (
          <button
            key={option.key}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="radio"
            className="repo-switch__option"
            {...optionData(option, pendingId)}
            data-tooltip={option.disabled ? UNLINKED_REPO_HINT : undefined}
            // In the tab row the name is hidden to fit beside nine tabs, unless
            // another repository shares the role; the native tooltip still
            // names the repository on hover.
            title={option.disabled ? undefined : option.label}
            aria-checked={option.current}
            aria-disabled={option.disabled || undefined}
            aria-describedby={option.disabled ? hintId : undefined}
            tabIndex={index === stop ? 0 : -1}
            onClick={() => open(option)}
            onKeyDown={(event) => onKeyDown(event, index)}
            onFocus={() => setFocused(index)}
          >
            <span className="repo-switch__role">{option.roleLabel}</span>
            <span className="repo-switch__name">{option.label}</span>
          </button>
        ))}
      </div>
      {/* Hidden, yet still read as the disabled options' description. */}
      {anyDisabled ? (
        <span id={hintId} hidden>
          {UNLINKED_REPO_HINT}
        </span>
      ) : null}
    </>
  );
}
