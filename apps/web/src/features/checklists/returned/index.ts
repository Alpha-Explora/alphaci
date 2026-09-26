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
