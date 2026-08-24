/* Domain types for the project detail surface. */
export type {
  AddCustomDomainRequest,
  CustomDomain,
  DomainVerificationChallenge,
  ProjectBranchPreview,
  ProjectOverviewResponse,
  ProjectPreviewsResponse,
  ProvisionedProject,
  RemoveCustomDomainResponse,
} from "@/lib/api/contracts";

/** Lifecycle of the project overview load. */
export type ProjectStatus = "loading" | "ready" | "error";
