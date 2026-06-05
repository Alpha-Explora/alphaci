"use client";

import { motion } from "framer-motion";

import type { CatalogTemplate } from "@/lib/api/contracts";

import { toSourcePath } from "./workflow-builder-utils";

interface WorkflowAllTabProps {
  allTemplates: CatalogTemplate[];
  onUseTemplate: (template: CatalogTemplate) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

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
      style={{ background: "transparent", border: "none", boxShadow: "none", padding: 0 }}
    >
      <div className="templates-header" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700 }}>All Templates</h2>
        <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{allTemplates.length} templates loaded from cicd-workflow</p>
      </div>

      {allTemplates.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.65rem",
            padding: "3rem 1rem",
            textAlign: "center",
            background: "rgba(15, 23, 42, 0.4)",
            border: "1px solid var(--border-soft)",
            borderRadius: "1rem"
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: "2.8rem",
              height: "2.8rem",
              borderRadius: "0.74rem",
              background: "rgba(56, 189, 248, 0.08)",
              border: "1px solid rgba(56, 189, 248, 0.2)",
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
            No templates loaded yet. Templates are sourced from <strong>cicd-workflow/workflow-templates</strong>.
          </p>
        </div>
      ) : null}

      <motion.div
        className="all-template-grid"
        variants={containerVariants}
        initial="hidden"
        animate="show"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}
      >
        {allTemplates.map((template) => (
          <motion.article
            key={template.id}
            variants={cardVariants}
            className="all-template-card glass-panel"
            style={{
              background: "rgba(15, 23, 42, 0.45)",
              border: "1px solid var(--border-soft)",
              borderRadius: "1.25rem",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.85rem",
              transition: "all 0.25s ease",
            }}
            whileHover={{
              y: -3,
              borderColor: "rgba(56, 189, 248, 0.3)",
              boxShadow: "var(--shadow-card), 0 0 24px rgba(56, 189, 248, 0.05)"
            }}
          >
            <div className="all-template-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.5rem" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>{template.name}</h3>
              <span className="template-stack-badge" style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "0.15rem 0.5rem",
                borderRadius: "4px",
                background: "rgba(56, 189, 248, 0.1)",
                color: "var(--brand)",
                border: "1px solid rgba(56, 189, 248, 0.15)"
              }}>{template.stack}</span>
            </div>
            
            <p className="template-card-description" style={{ fontSize: "0.84rem", color: "var(--text-secondary)", margin: 0, flex: 1, lineHeight: 1.45 }}>
              {template.description}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", padding: "0.6rem 0.75rem", background: "rgba(0,0,0,0.15)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                <span style={{ color: "var(--text-muted)" }}>Workflow:</span>
                <span style={{ fontFamily: "ui-monospace, monospace", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "20ch" }}>
                  {toSourcePath(template.workflowPath)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                <span style={{ color: "var(--text-muted)" }}>Properties:</span>
                <span style={{ fontFamily: "ui-monospace, monospace", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "20ch" }}>
                  {toSourcePath(template.propertiesPath)}
                </span>
              </div>
            </div>

            <div className="template-tag-row" style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", margin: "0.25rem 0 0" }}>
              {template.categories.slice(0, 4).map((category) => (
                <span key={`${template.id}-${category}`} className="template-tag" style={{
                  fontSize: "0.7rem",
                  padding: "0.15rem 0.45rem",
                  borderRadius: "999px",
                  background: "rgba(255, 255, 255, 0.04)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-soft)"
                }}>
                  {category}
                </span>
              ))}
            </div>

            <div className="result-actions" style={{ marginTop: "0.5rem", borderTop: "1px solid var(--border-soft)", paddingTop: "0.75rem" }}>
              <button
                className="ghost-button"
                type="button"
                onClick={() => onUseTemplate(template)}
                style={{
                  width: "100%",
                  padding: "0.5rem 1rem",
                  fontSize: "0.82rem",
                  minHeight: "2.2rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "0.5rem",
                  border: "1px solid rgba(56, 189, 248, 0.2)",
                  color: "var(--brand)",
                  background: "rgba(56, 189, 248, 0.04)",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--brand-light)";
                  e.currentTarget.style.borderColor = "var(--brand)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(56, 189, 248, 0.04)";
                  e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.2)";
                  e.currentTarget.style.color = "var(--brand)";
                }}
              >
                Use in Create Project
              </button>
            </div>
          </motion.article>
        ))}
      </motion.div>
    </motion.section>
  );
}
