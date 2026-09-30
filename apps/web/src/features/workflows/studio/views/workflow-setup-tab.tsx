"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import type {
  CreateProjectResult,
  DiscoverExistingRepoResponse,
  EnvOwnershipMode,
  SetupProjectResponse,
  WorkspaceSummary,
} from "@/shared/api/contracts";
import type { CreateProjectFormState } from "../view-models/use-create-project-form";
import type { DeploymentProvisioningFormState } from "../view-models/use-deployment-provisioning-form";
import type { GithubInstallationsState } from "../view-models/use-github-installations";
import type { ProjectOptionsCatalogState } from "../view-models/use-project-options-catalog";
import { useProjectUsage } from "../view-models/use-project-usage";
import {
  canSelectWizardStep,
  countWorkspaces,
  filterEnforcedOrgRepos,
  findProjectQuota,
  hasNoLinkedRepos,
  inferSingleProjectKind,
  isAutomationStepReady,
  isBlueprintReady,
  isCreateDisabled,
  isExistingDiscoverDisabled,
  isExistingSetupDisabled,
  isFinalCreateDisabled,
  isGenerateDisabled,
  isProjectQuotaReached,
  isRepositoryStepReady,
  nextWizardStep,
  teamChoiceState,
  wizardStepReadyFlags,
} from "../model/setup-tab-rules";
import { REPOSITORY_CREATE_LEAD_ONLY_NOTE } from "../model/role-gate-rules";
import { ExistingRepoSetupPanel } from "./existing-repo-setup-panel";
import { NewRepoWizard, RepositoryCreationProgress } from "./new-repo-wizard";
import { SetupModeToggle } from "./setup-mode-toggle";
import { SetupResultPanel } from "./setup-result-panel";
import { CatalogLoadingNotice, SetupTabHeader } from "./setup-tab-header";
import { WIZARD_STEPS } from "./setup-tab-shared";
import { SetupTeamScope } from "./setup-team-scope";
import { GenerateYamlLink } from "./setup-wizard-automation";

interface WorkflowSetupTabProps {
  /**
   * Team lead or admin (or a guest, who is sent to sign up instead). The
   * backend refuses repository creation and existing-repo onboarding for
   * everyone else, so the controls are replaced by a note.
   */
  canCreateRepositories: boolean;
  createResult: CreateProjectResult | null;
  /**
   * Where the create was started from. "in-team" means a team panel already
   * fixed the owning team; "choose-team" means the top-level Create Project
   * tab, where the caller's team is auto-selected if they have one and picked
   * if they have several. There is no unowned/individual scope — a project
   * always belongs to a team.
   */
  creationScope: "choose-team" | "in-team";
  /**
   * Teams the caller can create in — only supplied for the "choose-team"
   * scope, where no team context has already fixed the answer. `null` while
   * loading. A project always belongs to a team, so this is a required choice,
   * not a refinement of one the server can make on its own.
   */
  workspaces?: WorkspaceSummary[] | null;
  selectedWorkspaceId?: string | null;
  onChangeWorkspace?: (workspaceId: string | null) => void;
  /** "Team / Project" when a ?project= link files the repository in a Project. */
  targetProjectLabel?: string | null;
  deploymentOwnershipMode: EnvOwnershipMode;
  deploymentProvisioning: DeploymentProvisioningFormState;
  envProvisioningEnabled: boolean;
  existingRepoBaseBranch: string;
  existingRepoDiscovery: DiscoverExistingRepoResponse | null;
  existingRepoFullName: string;
  existingRepoResult: SetupProjectResponse | null;
  form: CreateProjectFormState;
  github: GithubInstallationsState;
  isCreatingProject: boolean;
  isDiscoveringExistingRepo: boolean;
  isSettingUpExistingRepo: boolean;
  setupMode: "new" | "existing";
  onChangeExistingRepoBaseBranch: (value: string) => void;
  onChangeExistingRepoFullName: (value: string) => void;
  onChangeSetupMode: (value: "new" | "existing") => void;
  onCreateProject: () => void;
  onDiscoverExistingRepo: () => void;
  onGenerateWorkflow: () => void;
  onSetupExistingRepo: () => void;
  onViewProject: () => void;
  projectCatalog: ProjectOptionsCatalogState;
  reducedMotion: boolean;
}

function setupTabEnter(reducedMotion: boolean) {
  if (reducedMotion) {
    return false;
  }
  return { opacity: 0, y: 16 };
}

function InlineSetupResult({
  createResult,
  existingRepoResult,
  onViewProject,
}: Readonly<{
  createResult: CreateProjectResult | null;
  existingRepoResult: SetupProjectResponse | null;
  onViewProject: () => void;
}>) {
  if (!createResult && !existingRepoResult) {
    return null;
  }
  return (
    <div className="cp-inline-result">
      <SetupResultPanel
        existingRepoResult={existingRepoResult}
        setupResult={createResult}
        onViewProject={onViewProject}
      />
    </div>
  );
}

export function WorkflowSetupTab({
  canCreateRepositories,
  createResult,
  deploymentOwnershipMode,
  creationScope,
  workspaces,
  selectedWorkspaceId,
  onChangeWorkspace,
  targetProjectLabel,
  deploymentProvisioning,
  envProvisioningEnabled,
  existingRepoBaseBranch,
  existingRepoDiscovery,
  existingRepoFullName,
  existingRepoResult,
  form,
  github,
  isCreatingProject,
  isDiscoveringExistingRepo,
  isSettingUpExistingRepo,
  setupMode,
  onChangeExistingRepoBaseBranch,
  onChangeExistingRepoFullName,
  onChangeSetupMode,
  onCreateProject,
  onDiscoverExistingRepo,
  onGenerateWorkflow,
  onSetupExistingRepo,
  onViewProject,
  projectCatalog,
  reducedMotion,
}: Readonly<WorkflowSetupTabProps>) {
  const usageItems = useProjectUsage();
  const [activeWizardStep, setActiveWizardStep] = useState(0);
  const [furthestWizardStep, setFurthestWizardStep] = useState(0);
  const isExistingMode = setupMode === "existing";
  const projectQuota = findProjectQuota(usageItems);
  const projectQuotaReached = isProjectQuotaReached(projectQuota);
  const hasSelectedProjectType = Boolean(projectCatalog.selectedProjectType);
  const createDisabled = isCreateDisabled({
    isCreatingProject,
    projectQuotaReached,
    loadingProjectOptions: projectCatalog.loadingProjectOptions,
    renderVariablesMissing: deploymentProvisioning.renderVariablesMissing,
    repoName: form.repoName,
    isMicroservicesShape: projectCatalog.isMicroservicesShape,
    isMultiRepoShape: projectCatalog.isMultiRepoShape,
    hasSelectedProjectType,
  });
  const generateDisabled = isGenerateDisabled({
    isCreatingProject,
    isDiscoveringExistingRepo,
    isSettingUpExistingRepo,
    loadingProjectOptions: projectCatalog.loadingProjectOptions,
    hasSelectedProjectType,
    serviceName: form.serviceName,
    repoName: form.repoName,
  });
  const existingDiscoverDisabled = isExistingDiscoverDisabled({
    isDiscoveringExistingRepo,
    isSettingUpExistingRepo,
    loadingProjectOptions: projectCatalog.loadingProjectOptions,
    existingRepoFullName,
  });
  const existingSetupDisabled = isExistingSetupDisabled({
    isDiscoveringExistingRepo,
    isSettingUpExistingRepo,
    loadingProjectOptions: projectCatalog.loadingProjectOptions,
    existingRepoFullName,
    hasSelectedProjectType,
  });
  const enforcedOrgLinkedRepos = filterEnforcedOrgRepos(
    github.linkedRepos,
    projectCatalog.enforcedOrg,
  );
  const noLinkedRepos = hasNoLinkedRepos({
    isExistingMode,
    linkedReposLoaded: github.linkedReposLoaded,
    loadingLinkedRepos: github.loadingLinkedRepos,
    linkedRepoCount: enforcedOrgLinkedRepos.length,
  });
  const selectedProjectKind = inferSingleProjectKind({
    selectedProjectTypeKind: projectCatalog.selectedProjectType?.kind,
    selectedProjectTypeId: projectCatalog.selectedProjectTypeId,
  });
  const team = teamChoiceState({
    creationScope,
    workspaceCount: countWorkspaces(workspaces),
    selectedWorkspaceId,
  });
  const wizardStepReady = wizardStepReadyFlags({
    blueprint: isBlueprintReady({
      selectedRepoShapeId: projectCatalog.selectedRepoShapeId,
      isMicroservicesShape: projectCatalog.isMicroservicesShape,
      isMultiRepoShape: projectCatalog.isMultiRepoShape,
      backendProjectTypeId: form.backendProjectTypeId,
      frontendProjectTypeId: form.frontendProjectTypeId,
      hasSelectedProjectType,
    }),
    repository: isRepositoryStepReady({
      repoName: form.repoName,
      isMicroservicesShape: projectCatalog.isMicroservicesShape,
      isMultiRepoShape: projectCatalog.isMultiRepoShape,
      serviceName: form.serviceName,
    }),
    automation: isAutomationStepReady(form.outputFileName, form.nodeVersion),
    delivery: !deploymentProvisioning.renderVariablesMissing,
    createReady: !createDisabled,
  });
  const finalCreateDisabled = isFinalCreateDisabled({
    createDisabled,
    teamChoiceMissing: team.teamChoiceMissing,
    priorStepsReady: wizardStepReady.slice(0, 4).every(Boolean),
  });

  function goToWizardStep(step: number) {
    if (!canSelectWizardStep(step, furthestWizardStep, wizardStepReady)) {
      return;
    }
    setActiveWizardStep(step);
  }

  function goToNextWizardStep() {
    if (!wizardStepReady[activeWizardStep]) {
      return;
    }
    const nextStep = nextWizardStep(activeWizardStep, WIZARD_STEPS.length);
    setFurthestWizardStep((current) => Math.max(current, nextStep));
    setActiveWizardStep(nextStep);
  }

  function goToPreviousWizardStep() {
    setActiveWizardStep((current) => Math.max(0, current - 1));
  }

  if (!canCreateRepositories) {
    return (
      <section
        className="create-project-layout"
        id="workflow-panel-setup"
        role="tabpanel"
        aria-labelledby="workflow-tab-setup"
        tabIndex={0}
      >
        <div className="create-project-main">
          <p className="env-empty-state" role="status">
            {REPOSITORY_CREATE_LEAD_ONLY_NOTE}
          </p>
        </div>
      </section>
    );
  }

  return (
    <motion.section
      className="create-project-layout"
      id="workflow-panel-setup"
      role="tabpanel"
      aria-labelledby="workflow-tab-setup"
      tabIndex={0}
      initial={setupTabEnter(reducedMotion)}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="create-project-main">
        <SetupTabHeader
          form={form}
          isExistingMode={isExistingMode}
          projectCatalog={projectCatalog}
        />
        <SetupTeamScope
          creationScope={creationScope}
          isExistingMode={isExistingMode}
          onChangeWorkspace={onChangeWorkspace}
          selectedWorkspaceId={selectedWorkspaceId}
          workspaces={workspaces}
          targetProjectLabel={targetProjectLabel}
        />
        <CatalogLoadingNotice loading={projectCatalog.loadingProjectOptions} />
        <RepositoryCreationProgress
          activeStep={activeWizardStep}
          furthestStep={furthestWizardStep}
          isExistingMode={isExistingMode}
          ready={wizardStepReady}
          onSelect={goToWizardStep}
        />
        {/* Mode toggle — hidden while existing-repo onboarding is disabled.
            Flip EXISTING_REPO_MODE_ENABLED to true to restore the segmented
            control; all handlers and the existing-mode panel remain wired. */}
        <SetupModeToggle
          setupMode={setupMode}
          onChangeSetupMode={onChangeSetupMode}
        />
        <ExistingRepoSetupPanel
          enforcedOrgLinkedRepos={enforcedOrgLinkedRepos}
          existingDiscoverDisabled={existingDiscoverDisabled}
          existingRepoBaseBranch={existingRepoBaseBranch}
          existingRepoDiscovery={existingRepoDiscovery}
          existingRepoFullName={existingRepoFullName}
          existingSetupDisabled={existingSetupDisabled}
          isDiscoveringExistingRepo={isDiscoveringExistingRepo}
          isExistingMode={isExistingMode}
          isSettingUpExistingRepo={isSettingUpExistingRepo}
          loadingLinkedRepos={github.loadingLinkedRepos}
          noLinkedRepos={noLinkedRepos}
          onChangeExistingRepoBaseBranch={onChangeExistingRepoBaseBranch}
          onChangeExistingRepoFullName={onChangeExistingRepoFullName}
          onDiscoverExistingRepo={onDiscoverExistingRepo}
          onRetryLinkedRepos={github.loadLinkedRepos}
          onSetupExistingRepo={onSetupExistingRepo}
        />
        <NewRepoWizard
          activeWizardStep={activeWizardStep}
          deploymentOwnershipMode={deploymentOwnershipMode}
          deploymentProvisioning={deploymentProvisioning}
          envProvisioningEnabled={envProvisioningEnabled}
          finalCreateDisabled={finalCreateDisabled}
          form={form}
          github={github}
          isCreatingProject={isCreatingProject}
          isExistingMode={isExistingMode}
          onBack={goToPreviousWizardStep}
          onCreateProject={onCreateProject}
          onNext={goToNextWizardStep}
          projectCatalog={projectCatalog}
          projectQuota={projectQuota}
          reducedMotion={reducedMotion}
          selectedProjectKind={selectedProjectKind}
          wizardStepReady={wizardStepReady}
        />
        <GenerateYamlLink
          activeWizardStep={activeWizardStep}
          generateDisabled={generateDisabled}
          isCreatingProject={isCreatingProject}
          isExistingMode={isExistingMode}
          onGenerateWorkflow={onGenerateWorkflow}
        />
        <InlineSetupResult
          createResult={createResult}
          existingRepoResult={existingRepoResult}
          onViewProject={onViewProject}
        />
      </div>
    </motion.section>
  );
}
