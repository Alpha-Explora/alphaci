import type { EnvOwnershipMode, UsageLimitItem } from "@/shared/api/contracts";
import type { CreateProjectFormState } from "../view-models/use-create-project-form";
import type { DeploymentProvisioningFormState } from "../view-models/use-deployment-provisioning-form";
import type { GithubInstallationsState } from "../view-models/use-github-installations";
import type { ProjectOptionsCatalogState } from "../view-models/use-project-options-catalog";
import type { TeamProjectOptionsStatus } from "../view-models/use-team-project-options";

/** A Developer's "which Project does this repository belong to" select. */
export interface ProjectChoice {
  status: TeamProjectOptionsStatus;
  /** A Project with no Feature yet is listed, disabled, with "(no Features yet)". */
  options: ReadonlyArray<{ id: string; label: string; disabled: boolean }>;
  /** The picked Project's id, or "" before one is picked. */
  selectedId: string;
  onSelect: (id: string) => void;
  onRetry: () => void;
}

export interface WizardStepProps {
  deploymentOwnershipMode: EnvOwnershipMode;
  deploymentProvisioning: DeploymentProvisioningFormState;
  envProvisioningEnabled: boolean;
  finalCreateDisabled: boolean;
  form: CreateProjectFormState;
  github: GithubInstallationsState;
  isCreatingProject: boolean;
  /** The Project the repository joins (read-only line, no name asked), or null. */
  joinedProjectName: string | null;
  onCreateProject: () => void;
  /**
   * A Developer without a `?project=` link chooses the Project here, in place
   * of the free Project name; null for everyone who need not choose.
   */
  projectChoice: ProjectChoice | null;
  /**
   * Why the repository cannot go into the chosen or linked Project yet (it
   * has no Feature), or null. Blocks the Repository step and Create.
   */
  projectBlocker?: string | null;
  projectCatalog: ProjectOptionsCatalogState;
  projectQuota: UsageLimitItem | null;
  selectedProjectKind: "frontend" | "backend";
}
