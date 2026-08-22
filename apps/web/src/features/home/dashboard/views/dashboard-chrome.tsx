"use client";

import { motion } from "framer-motion";

import { sectionVariants } from "./motion";

export function QuickActionCreateIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function QuickActionWorkflowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function QuickActionRunIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <polygon points="10 8 16 12 10 16" fill="currentColor" stroke="none" />
    </svg>
  );
}

const quickActions = [
  {
    cmd: "new-project",
    href: "/workflows?tab=setup",
    display: "Create Project",
    description: "Connect a repo and generate a pipeline",
    shortcut: "N",
    accent: "var(--brand)",
    icon: QuickActionCreateIcon,
  },
  {
    cmd: "view-projects",
    href: "/workflows?tab=current",
    display: "View Projects",
    description: "See every repository ALPHACI has provisioned",
    shortcut: "W",
    accent: "var(--accent-violet)",
    icon: QuickActionWorkflowIcon,
  },
  {
    cmd: "view-runs",
    href: "/runs",
    display: "View Runs",
    description: "Check live pipeline stage status",
    shortcut: "R",
    accent: "var(--success)",
    icon: QuickActionRunIcon,
  },
];

// Real pipeline stages reported by GET /ci/runs — mirrors the /runs page.

/* ── Ops insight rail — the "genuinely useful operational content" ─────────── */

export function KeyboardShortcuts({ reduced }: Readonly<{ reduced: boolean | null }>) {
  return (
    <motion.section
      className="dashboard-shortcuts"
      aria-label="Keyboard shortcuts"
      custom={3}
      variants={sectionVariants}
      initial={reduced ? false : "hidden"}
      animate="visible"
    >
      <span className="dashboard-shortcuts-label">Keyboard shortcuts</span>
      <div className="dashboard-shortcuts-keys">
        {quickActions.map((action) => (
          <span key={action.cmd} className="dashboard-shortcut">
            <kbd>{action.shortcut}</kbd>
            <span>{action.display}</span>
          </span>
        ))}
      </div>
    </motion.section>
  );
}

