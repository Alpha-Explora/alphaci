/* The developer-feedback slice: items QA returned, and "Mark fixed & request
 * re-test". The Overview card is the drop-in; the form and its ViewModel are
 * shared with the studio so a developer says "fixed" the same way in both. */
export { ReturnedByQaCard } from "./views/returned-by-qa-card";
export { RetestForm } from "./views/retest-form";
export {
  useRequestRetestViewModel,
  type RequestRetestViewModel,
  type RetestTarget,
} from "./view-models/use-request-retest-view-model";
