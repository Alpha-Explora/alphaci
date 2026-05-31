"use client";

import { motion } from "framer-motion";

import type { CatalogTemplate } from "@/lib/api/contracts";

import { toSourcePath } from "./workflow-builder-utils";

interface WorkflowAllTabProps {
  allTemplates: CatalogTemplate[];
  onUseTemplate: (template: CatalogTemplate) => void;
}

export function WorkflowAllTab({ allTemplates, onUseTemplate }: Readonly<WorkflowAllTabProps>) {
  return (
    <motion.section
      className="tab-content-panel"
      id="workflow-panel-all"
      role="tabpanel"
      aria-labelledby="workflow-tab-all"
      tabIndex={0}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="templates-header">
        <h2>All Templates</h2>
        <p>{allTemplates.length} templates from workflow-core</p>
      </div>
      <p className="helper-text">
        These are the source templates currently loaded from workflow-core/workflow-templates.
      </p>

      {allTemplates.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.65rem",
            padding: "2.4rem 1rem",
            textAlign: "center",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: "2.8rem",
              height: "2.8rem",
              borderRadius: "0.74rem",
              background: "rgba(59,142,240,0.08)",
              border: "1px solid rgba(59,142,240,0.2)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--brand)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="4 17 10 11 4 5"/>
              <line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
          </span>
          <p className="helper-text" style={{ maxWidth: "36ch", margin: 0 }}>
            No templates loaded yet. Templates are sourced from <strong>workflow-core/workflow-templates</strong>.
          </p>
        </div>
      ) : null}

      <div className="all-template-grid">
        {allTemplates.map((template) => (
          <article key={template.id} className="all-template-card">
            <div className="all-template-head">
              <h3>{template.name}</h3>
              <span className="template-stack-badge">{template.stack.toUpperCase()}</span>
            </div>
            <p className="template-card-description">{template.description}</p>
            <p className="helper-text">Workflow: {toSourcePath(template.workflowPath)}</p>
            <p className="helper-text">Properties: {toSourcePath(template.propertiesPath)}</p>
            <div className="template-tag-row">
              {template.categories.slice(0, 4).map((category) => (
                <span key={`${template.id}-${category}`} className="template-tag">
                  {category}
                </span>
              ))}
            </div>
            <div className="result-actions">
              <button
                className="ghost-button"
                type="button"
                onClick={() => onUseTemplate(template)}
              >
                Use in Create Project
              </button>
            </div>
          </article>
        ))}
      </div>
    </motion.section>
  );
}
