"use client";

import "./setup-wizard.css";

import { useState } from "react";
import { motion } from "framer-motion";

import type {
  CreateProjectResult,
  DiscoverExistingRepoResponse,
  EnvOwnershipMode,
  SetupProjectResponse,
  WorkspaceSummary,
} from "@/shared/api/contracts";
import { healthyHosts } from "@/features/hosts";
import type { CreateProjectFormState } from "../view-models/use-create-project-form";
import type { DeploymentProvisioningFormState } from "../view-models/use-deployment-provisioning-form";
import type { GithubInstallationsState } from "../view-models/use-github-installations";
import type { HostingChoiceState } from "../view-models/use-hosting-choice";
import type { ProjectOptionsCatalogState } from "../view-models/use-project-options-catalog";
import { useProjectUsage } from "../view-models/use-project-usage";
import { useSetupHostSelection } from "../view-models/use-setup-host-selection";
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
  isExistingSetupMode,
  isGenerateDisabled,
  isProjectChoiceMissing,
  isProjectQuotaReached,
  isRepositoryStepReady,
  nextWizardStep,
  teamChoiceState,
  wizardStepReadyFlags,
} from "../model/setup-tab-rules";
import { REPOSITORY_CREATE_ROLE_NOTE } from "../model/role-gate-rules";
import { renderVariablesBlockingFor } from "../model/hosting-choice-rules";
import {
  createBlockerReason,
  deliveryHostProblems,
  firstHostProblem,
  isDeliveryStepReady,
} from "../model/setup-delivery-rules";
import type { ProjectChoice } from "./setup-wizard-props";
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
   * Developer or admin (or a guest, who is sent to sign up instead). The
   * backend refuses repository creation and existing-repo onboarding for a
   * Product owner and QA Team, so the controls are replaced by a note.
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
  /**
   * Whether the Project is known (a resolved `?project=` link, or a
   * Developer's pick): its own team is used and the team box gives way to it.
   */
  projectKnown: boolean;
  /** Un-pick a Developer's Project to choose another team, or null. */
  onClearProject: (() => void) | null;
  /** "Team / Project" for the known Project, or null. */
  targetProjectLabel?: string | null;
  /** That Project's own name: the wizard shows "Adding to Project: <name>" and asks for none. */
  joinedProjectName?: string | null;
  /** A Developer's Project select (see WizardStepProps), or null. */
  projectChoice: ProjectChoice | null;
  /** Why the target Project cannot take a repository yet (no Feature), or null. */
  projectBlocker?: string | null;
  /**
   * Whether "Existing repository" is offered. Onboarding an existing
   * repository names a NEW Project, which a Developer may not create, so a
   * Developer only gets the new-repository path (filed in a Project).
   */
  existingRepoAllowed: boolean;
  deploymentOwnershipMode: EnvOwnershipMode;
  deploymentProvisioning: DeploymentProvisioningFormState;
  envProvisioningEnabled: boolean;
  /** The Delivery step's project-wide Hosting choice. */
  hosting: HostingChoiceState;
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

/** The Repository step in WIZARD_STEPS. */
const REPOSITORY_STEP_INDEX = 1;

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
  projectKnown,
  onClearProject,
  targetProjectLabel,
  joinedProjectName = null,
  projectChoice,
  projectBlocker = null,
  existingRepoAllowed,
  deploymentProvisioning,
  envProvisioningEnabled,
  hosting,
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
  // The machine list is read here, not only by the Delivery step's rows: whether
  // the rows show decides whether an on-prem problem can hold the wizard.
  const hostSelection = useSetupHostSelection();
  const [activeWizardStep, setActiveWizardStep] = useState(0);
  const [furthestWizardStep, setFurthestWizardStep] = useState(0);
  const isExistingMode = isExistingSetupMode(setupMode, existingRepoAllowed);
  const projectQuota = findProjectQuota(usageItems);
  const projectQuotaReached = isProjectQuotaReached(projectQuota);
  const hasSelectedProjectType = Boolean(projectCatalog.selectedProjectType);
  // Only Vercel / Render has a Render service to configure, so the
  // Render-variable rule holds the Delivery step and Create for it alone.
  const renderVariablesMissing = renderVariablesBlockingFor({
    choice: hosting.choice,
    provisioningOffered: envProvisioningEnabled,
    missing: deploymentProvisioning.hostedRenderVariablesMissing,
  });
  const createDisabled = isCreateDisabled({
    isCreatingProject,
    projectQuotaReached,
    loadingProjectOptions: projectCatalog.loadingProjectOptions,
    renderVariablesMissing,
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
    projectName: form.projectName,
    projectNameServerError: form.projectNameError,
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
    projectKnown,
  });
  // The on-prem host problems hold the Delivery step and Create, so they are
  // shown on the Delivery step and again above the Review step's button. They
  // are only checked while the machine rows are on screen to fix them.
  const hostProblems = deliveryHostProblems({
    choice: hosting.choice,
    environments: form.environments,
    machineRowsShown: healthyHosts(hostSelection.hosts).length > 0,
  });
  const hostProblem = firstHostProblem(hostProblems);
  const createBlocker = createBlockerReason({
    teamChoiceMissing: team.teamChoiceMissing,
    hostProblem,
    renderVariablesMissing,
    projectBlocker,
    projectQuota,
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
      projectName: joinedProjectName === null ? form.projectName : null,
      projectNameServerError: form.projectNameError,
      projectChoiceMissing: isProjectChoiceMissing(projectChoice) || projectBlocker !== null,
      repoName: form.repoName,
      isMicroservicesShape: projectCatalog.isMicroservicesShape,
      isMultiRepoShape: projectCatalog.isMultiRepoShape,
    }),
    automation: isAutomationStepReady(form.nodeVersion),
    delivery: isDeliveryStepReady({ renderVariablesMissing, hostProblem }),
    createReady: !createDisabled,
  });
  const finalCreateDisabled = isFinalCreateDisabled({
    createDisabled,
    teamChoiceMissing: team.teamChoiceMissing,
    priorStepsReady: wizardStepReady.slice(0, 4).every(Boolean),
  });

  // A "name taken" refusal takes the user back to the Repository step, where
  // the field shows it. Applied while rendering (state derived from a changing
  // input), not in an effect.
  const [seenProjectNameError, setSeenProjectNameError] = useState<string | null>(null);
  if (form.projectNameError !== seenProjectNameError) {
    setSeenProjectNameError(form.projectNameError);
    if (form.projectNameError && !isExistingMode) {
      setActiveWizardStep(REPOSITORY_STEP_INDEX);
    }
  }

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
        aria-label="Create project"
      >
        <div className="create-project-main">
          <p className="env-empty-state" role="status">
            {REPOSITORY_CREATE_ROLE_NOTE}
          </p>
        </div>
      </section>
    );
  }

  return (
    <motion.section
      className="create-project-layout"
      id="workflow-panel-setup"
      aria-label="Create project"
      initial={setupTabEnter(reducedMotion)}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="create-project-main">
        <SetupTabHeader
          // The top-level create view already has the page's "Create project"
          // h1; a team panel has no heading of its own, so it keeps this one.
          showTitle={creationScope === "in-team"}
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
          projectKnown={projectKnown}
          onClearProject={onClearProject}
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
          allowed={existingRepoAllowed}
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
          onChangeProjectName={form.setProjectName}
          onDiscoverExistingRepo={onDiscoverExistingRepo}
          onRetryLinkedRepos={github.loadLinkedRepos}
          onSetupExistingRepo={onSetupExistingRepo}
          projectName={form.projectName}
          projectNameError={form.projectNameError}
        />
        <NewRepoWizard
          activeWizardStep={activeWizardStep}
          deploymentOwnershipMode={deploymentOwnershipMode}
          deploymentProvisioning={deploymentProvisioning}
          envProvisioningEnabled={envProvisioningEnabled}
          hosting={hosting}
          finalCreateDisabled={finalCreateDisabled}
          form={form}
          github={github}
          isCreatingProject={isCreatingProject}
          isExistingMode={isExistingMode}
          joinedProjectName={joinedProjectName}
          projectChoice={projectChoice}
          projectBlocker={projectBlocker}
          createBlocker={createBlocker}
          hostProblems={hostProblems}
          hostSelection={hostSelection}
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
