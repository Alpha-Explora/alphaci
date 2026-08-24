/* Domain types for the project detail surface. */
export type {
  ProjectOverviewResponse,
  ProvisionedProject,
} from "@/shared/api/contracts";

/** Lifecycle of the project overview load. */
export type ProjectStatus = "loading" | "ready" | "error";
