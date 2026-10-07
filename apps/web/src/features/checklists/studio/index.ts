/* QA Studio — the project's "QA Studio" tab: preview a deployed branch and
 * verify a checklist against its commit, side by side. The panel owns its
 * ViewModels; the project page only mounts it. */
export { QaStudioPanel } from "./views/qa-studio-panel";
/* What the project page hands the studio's Playwright tab: its own checks
 * (visual changes, browser tests) for one repository. */
export type { RenderRepositoryChecks } from "./views/playwright-panel";
export type { RepositoryRef } from "../model/playwright-tab-rules";
/* The read-only "Ready for production" card, for the Overview a Developer sees. */
export { ProductionReadinessCard } from "./views/production-readiness-card";
/* The Project QA run: every repository's uat head and the one run that
 * verifies them together. QA Studio shows it beside the preview for a
 * repository filed under a Project; the Project page mounts it too. */
export { ProjectRunPanel } from "./views/project-run-panel";
export {
  useProjectRunViewModel,
  type ProjectRunViewModel,
} from "./view-models/use-project-run-view-model";
