/* Project Iterations — a leaf slice: the Project header's "Iteration 3 ·
 * Active" status, the read-only banner on a delivered iteration, and the
 * ViewModel that reads the Project's current iteration. It imports only the
 * checklists domain's model and data, so any slice or feature (the project
 * page, the delivery-project page, QA Studio, requirements) can use it
 * without an import cycle. */
export { IterationLockedNotice, IterationStatus, IterationStatusPill } from "./views/iteration-status";
export {
  useCurrentIterationViewModel,
  type CurrentIterationStatus,
  type CurrentIterationViewModel,
} from "./view-models/use-current-iteration-view-model";
