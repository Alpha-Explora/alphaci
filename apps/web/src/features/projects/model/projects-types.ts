/* Domain types for the project detail surface. */
export type {
  ProjectBranchPreview,
  ProjectOverviewResponse,
  ProjectPreviewsResponse,
  ProvisionedProject,
} from "@/lib/api/contracts";

/** Lifecycle of the project overview load. */
export type ProjectStatus = "loading" | "ready" | "error";
