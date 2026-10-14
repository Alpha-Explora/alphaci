import type { CSSProperties } from "react";

/**
 * Existing-repository onboarding.
 *
 * Switched ON 2026-08-18, after the setup path stopped assuming the default
 * branch was 'main', stopped overwriting a repository's own SonarCloud
 * secrets, started creating `uat` so the staging half of the pipeline runs,
 * and started cleaning up its own secrets when a setup fails. Discovery now
 * reports what will happen before anything is written.
 *
 * Handlers, state, and the existing-mode panel stay wired — flip this flag
 * to hide the "New / Existing repository" segmented control.
 */
export const EXISTING_REPO_MODE_ENABLED = true;

export const WIZARD_STEPS = [
  { label: "Blueprint", detail: "Shape and stack" },
  { label: "Repository", detail: "Name and visibility" },
  { label: "Automation", detail: "Runtime and coverage" },
  { label: "Delivery", detail: "Hosting" },
  { label: "Review", detail: "Confirm and create" },
] as const;

export const labelAccentStyle: CSSProperties = {
  borderLeft: "2px solid var(--brand)",
  paddingLeft: "0.5rem",
  color: "var(--text-secondary)",
  fontSize: "0.72rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
