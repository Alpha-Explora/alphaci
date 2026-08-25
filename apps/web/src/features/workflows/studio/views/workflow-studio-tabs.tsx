"use client";

import type { KeyboardEvent } from "react";
import { motion } from "framer-motion";

import type { WorkflowTab } from "../model/workflow-studio-rules";

interface WorkflowStudioTabsProps {
  activeTab: WorkflowTab;
  onChange: (tab: WorkflowTab) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, tab: WorkflowTab) => void;
  /** Right-aligned content after the tabs (e.g. GitHub App status). */
  trailing?: React.ReactNode;
}

const TABS: { id: WorkflowTab; label: string; icon: React.ReactNode }[] = [
  {
    id: "current",
    label: "Current Projects",
    icon: (
      <svg className="studio-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    id: "setup",
    label: "Create Project",
    icon: (
      <svg className="studio-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
  },
];

export function WorkflowStudioTabs({ activeTab, onChange, onKeyDown, trailing }: Readonly<WorkflowStudioTabsProps>) {
  return (
    <div
      className="studio-tab-bar studio-tab-bar--enhanced glass-panel"
      role="tablist"
      aria-label="Create project functions"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`workflow-tab-${tab.id}`}
          aria-controls={`workflow-panel-${tab.id}`}
          aria-selected={activeTab === tab.id}
          tabIndex={activeTab === tab.id ? 0 : -1}
          className={`studio-tab-button ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => onKeyDown(event, tab.id)}
          style={{ position: "relative" }}
        >
          {activeTab === tab.id && (
            <motion.span
              layoutId="tab-indicator"
              className="studio-tab-indicator"
              aria-hidden="true"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center" }}>
            {tab.icon}
            {tab.label}
          </span>
        </button>
      ))}
      {trailing ? <div className="studio-tab-trailing">{trailing}</div> : null}
    </div>
  );
}
