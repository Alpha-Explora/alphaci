/* Domain types for the project detail surface. */
export type {
  AddCustomDomainRequest,
  CustomDomain,
  DomainVerificationChallenge,
  ProjectBranchPreview,
  ProjectBranchPreviewSurface,
  ProjectOverviewResponse,
  ProjectPreviewsResponse,
  ProvisionedProject,
  RemoveCustomDomainResponse,
} from "@/shared/api/contracts";

/** Lifecycle of the project overview load. */
export type ProjectStatus = "loading" | "ready" | "error";
