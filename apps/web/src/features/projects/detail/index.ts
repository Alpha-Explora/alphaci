export { ProjectDetailView } from "./views/project-detail-view";
export { ProjectDetailTabs } from "./views/project-detail-tabs";
export { WorkflowStageList } from "./views/workflow-stage-list";
export { ProjectEnvPanel } from "./views/project-env-panel";
export { useProjectDetailViewModel } from "./view-models/use-project-detail-view-model";
export type { ProjectDetailViewModel } from "./view-models/use-project-detail-view-model";
export { usePipelineRunsViewModel, RUNS_POLL_MS } from "./view-models/use-pipeline-runs-view-model";
export type { PipelineRunsViewModel } from "./view-models/use-pipeline-runs-view-model";
export { groupRunsByPipelineBranch } from "./model/runs-by-branch";
export type { BranchRun, BranchRunSection } from "./model/runs-by-branch";
/* The studio role gates — notifications' deep-link rules (spec §8.6) send a
 * viewer to their own studio (`#qa` or `#po`), else `#overview`. */
export { canOpenQaStudio, studioTabFor } from "./model/project-detail-tab-rules";
