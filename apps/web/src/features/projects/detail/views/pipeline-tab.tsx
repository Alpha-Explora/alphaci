"use client";

import "./pipeline-tab.css";

import { useRef, type KeyboardEvent } from "react";

import type { ProvisionedProject } from "@/features/projects";
import { nextTabIndex } from "../model/hosting-environment-rules";
import type { PipelineView } from "../model/project-detail-tab-rules";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { RunsTab } from "./runs-tab";
import { WorkflowTab } from "./workflow-tab";

/** The two views, in toggle order; Runs is the default. */
export const PIPELINE_VIEWS: ReadonlyArray<{ id: PipelineView; label: string; description: string }> = [
  { id: "runs", label: "Runs", description: "What ran on each branch, and what it reported back." },
  { id: "configuration", label: "Configuration", description: "The workflow that produces these runs." },
];

const VIEW_PANEL_ID = "project-detail-pipeline-view";

export function pipelineViewTabId(view: PipelineView): string {
  return `project-detail-pipeline-${view}`;
}

/**
 * The Pipeline tab: Runs (what ran) and Configuration (the workflow that ran
 * it; once the Workflow tab). One slim row heads it: the view's name at the
 * left and, where Configuration is offered, a two-way toggle at the right.
 * Runs reads exactly as the Pipeline runs tab did under that row.
 */
export function PipelineTab({
  project,
  vm,
  dangerZone,
}: Readonly<{
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
  dangerZone?: React.ReactNode;
}>) {
  const withToggle = vm.pipelineConfigurationAvailable;
  return (
    <div
      role="tabpanel"
      id="project-detail-panel-pipeline"
      aria-labelledby="project-detail-tab-pipeline"
      className="pipeline-tab"
    >
      <div className="pipeline-tab__head">
        <PipelineHeading view={vm.pipelineView} />
        {withToggle ? <PipelineViewToggle view={vm.pipelineView} onSelect={vm.setPipelineView} /> : null}
      </div>
      <div
        id={VIEW_PANEL_ID}
        role={withToggle ? "tabpanel" : undefined}
        aria-labelledby={withToggle ? pipelineViewTabId(vm.pipelineView) : undefined}
      >
        {vm.pipelineView === "configuration" ? (
          <WorkflowTab project={project} vm={vm} dangerZone={dangerZone} />
        ) : (
          <RunsTab project={project} vm={vm} />
        )}
      </div>
    </div>
  );
}

function PipelineHeading({ view }: Readonly<{ view: PipelineView }>) {
  const current = PIPELINE_VIEWS.find((item) => item.id === view) ?? PIPELINE_VIEWS[0];
  return (
    <div className="pipeline-tab__title">
      <h2 className="pipeline-tab__name">{current.label}</h2>
      <p className="pipeline-tab__hint">{current.description}</p>
    </div>
  );
}

/**
 * Runs | Configuration as WAI-ARIA tabs, the Hosting environment switcher's
 * pattern in a smaller size: one tab stop (the selected view), arrow keys,
 * Home and End move between the two, and selection follows focus.
 */
function PipelineViewToggle({
  view,
  onSelect,
}: Readonly<{ view: PipelineView; onSelect: (view: PipelineView) => void }>) {
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = nextTabIndex(event.key, index, PIPELINE_VIEWS.length);
    if (next === null) return;
    event.preventDefault();
    onSelect(PIPELINE_VIEWS[next].id);
    tabs.current[next]?.focus();
  }

  return (
    <div className="pipeline-toggle" role="tablist" aria-label="Pipeline views">
      {PIPELINE_VIEWS.map((item, index) => {
        const selected = item.id === view;
        return (
          <button
            key={item.id}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            id={pipelineViewTabId(item.id)}
            type="button"
            role="tab"
            className="pipeline-toggle__tab"
            aria-selected={selected}
            aria-controls={VIEW_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
