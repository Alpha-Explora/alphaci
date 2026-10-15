/* Project Iterations — a leaf slice: the Project header's "Iteration 3 ·
 * Active" status, the read-only banner on a delivered iteration, the
 * ViewModel that reads the Project's current iteration, and (phase 3)
 * "Start iteration N+1" with its dialog (the new iteration starts empty) and the waiting sentence
 * for everyone else. It imports only the checklists domain's model and data
 * (and the shared dialog primitive), so any slice or feature (the project
 * page, the delivery-project page, QA Studio, requirements, My QA items) can
 * use it without an import cycle. */
export { IterationLockedNotice, IterationStatus, IterationStatusPill } from "./views/iteration-status";
export {
  IterationHeader,
  IterationNextStep,
  IterationNextStepView,
  IterationWaitingNotice,
  StartIterationAction,
  StartIterationDialog,
} from "./views/start-iteration";
export {
  useCurrentIterationViewModel,
  type CurrentIterationStatus,
  type CurrentIterationViewModel,
} from "./view-models/use-current-iteration-view-model";
export { announceIterationChanged, useIterationEpoch } from "./view-models/iteration-epoch";
export { useNextIterationViewModel } from "./view-models/use-next-iteration-view-model";
export {
  useStartIterationViewModel,
  type StartIterationViewModel,
} from "./view-models/use-start-iteration-view-model";
