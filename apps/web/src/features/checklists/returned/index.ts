/* The developer slice: the Overview's "My QA items" card — items QA returned
 * ("Mark fixed & request re-test") and the current uat run's developer items.
 * The card is the drop-in; the re-test form and its ViewModel are shared with
 * the studio so a developer says "fixed" the same way in both. */
export { MyQaItemsCard } from "./views/my-qa-items-card";
export { RetestForm } from "./views/retest-form";
export {
  useRequestRetestViewModel,
  type RequestRetestViewModel,
  type RetestTarget,
} from "./view-models/use-request-retest-view-model";
/* Project requirements: a Developer moves each item's Progress (To do, In
 * progress, Done) with one control, shared by the Project's requirements and
 * the project-wide "My QA items" list. */
export { ProjectMyItemsCard } from "./views/project-my-items-card";
export { ProgressControl } from "./views/progress-control";
export {
  useItemProgressViewModel,
  type ItemProgressViewModel,
} from "./view-models/use-item-progress-view-model";
