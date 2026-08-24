/**
 * Branch previews — the slice's public API.
 *
 * `BranchPreviewsPanel` is the drop-in: it owns its own ViewModel, so the
 * still-unmigrated project detail surface in `src/components/product/` can
 * mount previews through this barrel rather than reaching past it.
 */
export { BranchPreviewsPanel } from "./views/branch-previews-panel";

/* Presentation without the fetch, for fixtures and tests. */
export { BranchPreviewsView } from "./views/branch-previews-view";
export type { BranchPreviewsViewProps } from "./views/branch-previews-view";

export {
  useBranchPreviewsViewModel,
  type BranchPreviewsViewModel,
} from "./view-models/use-branch-previews-view-model";
