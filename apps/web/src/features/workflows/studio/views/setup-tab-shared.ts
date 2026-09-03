import type { CSSProperties } from "react";
import type { MvpProjectOptionKey } from "@/shared/api/contracts";

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
  { label: "Repository", detail: "Name and service" },
  { label: "Automation", detail: "Workflow and checks" },
  { label: "Delivery", detail: "Deployment options" },
  { label: "Review", detail: "Confirm and create" },
] as const;

export const projectOptionDescriptions: Record<MvpProjectOptionKey, string> = {
  lint: "Run code quality checks before build.",
  unit: "Run the starter project's test script.",
  build: "Compile or bundle the project.",
  coverage: "Enforce the configured coverage threshold.",
  security: "Run dependency and workflow security checks.",
  docker: "Build a container image when the recipe supports it.",
};

export const labelAccentStyle: CSSProperties = {
  borderLeft: "2px solid var(--brand)",
  paddingLeft: "0.5rem",
  color: "var(--text-secondary)",
  fontSize: "0.72rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
