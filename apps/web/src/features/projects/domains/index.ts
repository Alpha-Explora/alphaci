/**
 * Custom domains — the slice's public API.
 *
 * `ProjectDomainsPanel` is the drop-in for the still-unmigrated project detail
 * surface in `src/components/product/`, which may consume this barrel but not
 * reach past it.
 */
export { ProjectDomainsPanel } from "./views/project-domains-panel";

/* Presentation without the fetch, for fixtures and tests. */
export { ProjectDomainsView } from "./views/project-domains-view";
export type { ProjectDomainsViewProps } from "./views/project-domains-view";

export {
  useProjectDomainsViewModel,
  type ProjectDomainsViewModel,
} from "./view-models/use-project-domains-view-model";
