import type { EnvOwnershipMode, UsageLimitItem } from "@/shared/api/contracts";
import type { CreateProjectFormState } from "../view-models/use-create-project-form";
import type { DeploymentProvisioningFormState } from "../view-models/use-deployment-provisioning-form";
import type { GithubInstallationsState } from "../view-models/use-github-installations";
import type { ProjectOptionsCatalogState } from "../view-models/use-project-options-catalog";

export interface WizardStepProps {
  deploymentOwnershipMode: EnvOwnershipMode;
  deploymentProvisioning: DeploymentProvisioningFormState;
  envProvisioningEnabled: boolean;
  finalCreateDisabled: boolean;
  form: CreateProjectFormState;
  github: GithubInstallationsState;
  isCreatingProject: boolean;
  onCreateProject: () => void;
  projectCatalog: ProjectOptionsCatalogState;
  projectQuota: UsageLimitItem | null;
  selectedProjectKind: "frontend" | "backend";
}
