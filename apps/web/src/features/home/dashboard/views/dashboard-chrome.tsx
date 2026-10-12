"use client";

import { motion } from "framer-motion";

import { HOME_SHORTCUTS } from "../../model/home-layout-rules";
import type { HomeShortcutId } from "../../model/home-persona-types";
import { sectionVariants } from "./motion";

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

/** The footer legend for the role's keyboard shortcuts (the QA Team has no N). */
export function KeyboardShortcuts({
  reduced,
  shortcuts,
}: Readonly<{ reduced: boolean | null; shortcuts: ReadonlyArray<HomeShortcutId> }>) {
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
        {shortcuts.map((id) => (
          <span key={id} className="dashboard-shortcut">
            <kbd>{HOME_SHORTCUTS[id].key.toUpperCase()}</kbd>
            <span>{HOME_SHORTCUTS[id].label}</span>
          </span>
        ))}
      </div>
    </motion.section>
  );
}
