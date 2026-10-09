/* QA report — the printable report pages (Download PDF): a repository's QA run,
 * a Project's QA run and a CI run's results. They render without the app shell;
 * the routes only mount them. */
export { CiRunReportView } from "./views/ci-run-report-view";
export { ProjectQaReportView, type RenderRepositoryEvidence } from "./views/project-report-view";
export { QaReportView } from "./views/qa-report-view";
