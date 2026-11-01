/* Project requirements — a Project's Features (functional, told as User
 * stories) and System requirements, with each item's Progress; and the
 * Project QA workspace that adds the Project's QA run and its project-wide
 * "My QA items". The workspace owns its ViewModels; a Project page only
 * mounts it. */
export { ProjectQaWorkspace } from "./views/project-qa-workspace";
export { ProjectRequirementsPanel } from "./views/project-requirements-panel";
export {
  useProjectRequirementsViewModel,
  type ProjectRequirementsViewModel,
} from "./view-models/use-project-requirements-view-model";
