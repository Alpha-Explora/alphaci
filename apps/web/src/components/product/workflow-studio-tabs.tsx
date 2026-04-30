"use client";

import type { KeyboardEvent } from "react";

import type { WorkflowTab } from "./workflow-builder-utils";

interface WorkflowStudioTabsProps {
  activeTab: WorkflowTab;
  onChange: (tab: WorkflowTab) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, tab: WorkflowTab) => void;
}

export function WorkflowStudioTabs({ activeTab, onChange, onKeyDown }: Readonly<WorkflowStudioTabsProps>) {
  return (
    <div className="studio-tab-bar glass-panel" role="tablist" aria-label="Create project functions">
      <button
        type="button"
        role="tab"
        id="workflow-tab-setup"
        aria-controls="workflow-panel-setup"
        aria-selected={activeTab === "setup"}
        tabIndex={activeTab === "setup" ? 0 : -1}
        className={`studio-tab-button ${activeTab === "setup" ? "active" : ""}`}
        onClick={() => onChange("setup")}
        onKeyDown={(event) => onKeyDown(event, "setup")}
      >
        <svg className="studio-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        {"Create Project"}
      </button>
      <button
        type="button"
        role="tab"
        id="workflow-tab-current"
        aria-controls="workflow-panel-current"
        aria-selected={activeTab === "current"}
        tabIndex={activeTab === "current" ? 0 : -1}
        className={`studio-tab-button ${activeTab === "current" ? "active" : ""}`}
        onClick={() => onChange("current")}
        onKeyDown={(event) => onKeyDown(event, "current")}
      >
        <svg className="studio-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        {"Current Projects"}
      </button>
      <button
        type="button"
        role="tab"
        id="workflow-tab-all"
        aria-controls="workflow-panel-all"
        aria-selected={activeTab === "all"}
        tabIndex={activeTab === "all" ? 0 : -1}
        className={`studio-tab-button ${activeTab === "all" ? "active" : ""}`}
        onClick={() => onChange("all")}
        onKeyDown={(event) => onKeyDown(event, "all")}
      >
        <svg className="studio-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        {"Catalog"}
      </button>
    </div>
  );
}
