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
