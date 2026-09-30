"use client";

import { MotionConfig, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";

import { useWorkflowStudioViewModel } from "../view-models/use-workflow-studio-view-model";
import { statusBannerVariant } from "../model/workflow-studio-rules";
import { canCreateRepositories } from "../model/role-gate-rules";
import { WorkflowCurrentTab } from "./workflow-current-tab";
import { GeneratingOverlay } from "./generating-overlay";
import { WorkflowSetupTab } from "./workflow-setup-tab";
import { BackIcon, GuideIcon } from "./studio-icons";

interface WorkflowBuilderProps {
  login: string;
  plan: string;
  guest?: boolean;
  onboardingCompleted?: boolean;
  session?: import("@/shared/api/contracts").AuthMeResponse | null;
}

function WorkflowStatusBanners({
  statusMessage,
  catalogError,
  projectOptionsError,
}: Readonly<{
  statusMessage: string | null;
  catalogError: string | null;
  projectOptionsError: string | null;
}>) {
  if (!statusMessage && !catalogError && !projectOptionsError) return null;
  return (
    <div style={{ padding: "0.5rem var(--layout-gutter) 0" }}>
      {statusMessage ? (
        <motion.p
          className={`status-banner ${statusBannerVariant(statusMessage)}`}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {statusMessage}
        </motion.p>
      ) : null}
      {catalogError ? (
        <div className="error-inline" role="alert">
          <span className="error-inline-icon" aria-hidden="true">⚠</span>
          <p className="error-inline-msg">{catalogError}</p>
        </div>
      ) : null}
      {projectOptionsError ? (
        <div className="error-inline" role="alert">
          <span className="error-inline-icon" aria-hidden="true">⚠</span>
          <p className="error-inline-msg">{projectOptionsError}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The create view's heading row: the page's h1, the way back to the projects
 * view, and the create-project tour (hidden for guests, as before).
 */
function SetupViewHeader({
  guest,
  onBack,
  onStartTour,
}: Readonly<{ guest: boolean; onBack: () => void; onStartTour: () => void }>) {
  return (
    <div className="project-detail-header current-projects-header">
      <div className="current-projects-heading">
        <h1 className="workflow-page-title">Create project</h1>
        <p>Provision a repository and its gated ALPHACI workflow inside one of your teams.</p>
      </div>
      <div className="current-projects-actions">
        <button type="button" className="ghost-button" onClick={onBack}>
          <BackIcon />
          Back to projects
        </button>
        {guest ? null : (
          <button
            type="button"
            className="ghost-button"
            aria-label="Show guided tour for the Create Project form"
            onClick={onStartTour}
          >
            <GuideIcon />
            Show guide
          </button>
        )}
      </div>
    </div>
  );
}

export function WorkflowBuilder({ guest = false, session, onboardingCompleted }: Readonly<WorkflowBuilderProps>) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = prefersReducedMotion === true;
  const vm = useWorkflowStudioViewModel({ guest, session, onboardingCompleted });
  const canCreateRepos = canCreateRepositories(session?.appRole, guest);
  const sendGuestToSignup = () => router.push("/signup");
  const {
    activeView, statusMessage, isCreatingProject, isDiscoveringExistingRepo, isSettingUpExistingRepo,
    createResult, existingRepoDiscovery, existingRepoResult, setupMode, setSetupMode,
    existingRepoFullName, setExistingRepoFullName, existingRepoBaseBranch, setExistingRepoBaseBranch,
    workspaces, selectedCreateWorkspaceId, setSelectedCreateWorkspaceId, targetProjectLabel,
    showProjects, openCreateForGroup, openIndividualSetup,
    handleCreateProject, handleDiscoverExistingRepo, handleSetupExistingRepo, handleGenerateWorkflow,
    catalog, projectCatalog, projects, createForm, deploymentProvisioning,
    deploymentOwnershipMode, envProvisioningEnabled, github, startTour, startCurrentProjectsTour,
  } = vm;

  const actions = studioGuestActions({
    guest,
    sendGuestToSignup,
    handleCreateProject,
    handleDiscoverExistingRepo,
    handleGenerateWorkflow,
    handleSetupExistingRepo,
    selectedCreateWorkspaceId,
  });

  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "never"}>
      <GeneratingOverlay isVisible={isCreatingProject} />
      <section className="workflow-surface">
        <WorkflowStatusBanners
          statusMessage={statusMessage}
          catalogError={catalog.catalogError}
          projectOptionsError={projectCatalog.projectOptionsError}
        />
        <div className="workflow-view-body">
          {activeView === "setup" ? (
            <div className="project-detail-panel project-detail-panel--page setup-view">
              <SetupViewHeader guest={guest} onBack={showProjects} onStartTour={startTour} />
              <WorkflowSetupTab
                canCreateRepositories={canCreateRepos}
                form={createForm}
                deploymentOwnershipMode={deploymentOwnershipMode}
                deploymentProvisioning={deploymentProvisioning}
                envProvisioningEnabled={envProvisioningEnabled}
                github={github}
                existingRepoBaseBranch={existingRepoBaseBranch}
                existingRepoDiscovery={existingRepoDiscovery}
                existingRepoFullName={existingRepoFullName}
                existingRepoResult={existingRepoResult}
                isCreatingProject={isCreatingProject}
                isDiscoveringExistingRepo={isDiscoveringExistingRepo}
                isSettingUpExistingRepo={isSettingUpExistingRepo}
                setupMode={setupMode}
                onChangeExistingRepoBaseBranch={setExistingRepoBaseBranch}
                onChangeExistingRepoFullName={setExistingRepoFullName}
                onChangeSetupMode={setSetupMode}
                onCreateProject={actions.onCreateProject}
                onDiscoverExistingRepo={actions.onDiscoverExistingRepo}
                onGenerateWorkflow={actions.onGenerateWorkflow}
                onSetupExistingRepo={actions.onSetupExistingRepo}
                creationScope="choose-team"
                workspaces={workspaces}
                selectedWorkspaceId={selectedCreateWorkspaceId}
                onChangeWorkspace={setSelectedCreateWorkspaceId}
                targetProjectLabel={targetProjectLabel}
                projectCatalog={projectCatalog}
                onViewProject={openIndividualSetup}
                reducedMotion={reducedMotion}
                createResult={createResult}
              />
            </div>
          ) : null}
          {activeView === "current" ? (
            <WorkflowCurrentTab
              latestResult={createResult}
              loadingProjects={projects.loadingProjects}
              onOpenSetup={openIndividualSetup}
              canCreateProjects={canCreateRepos}
              onCreateProject={guest ? sendGuestToSignup : openCreateForGroup}
              onStartGuide={guest ? undefined : startCurrentProjectsTour}
            />
          ) : null}
        </div>
      </section>
    </MotionConfig>
  );
}

function studioGuestActions(input: {
  guest: boolean;
  sendGuestToSignup: () => void;
  handleCreateProject: (workspaceId?: string) => unknown;
  handleDiscoverExistingRepo: () => void;
  handleGenerateWorkflow: () => void;
  handleSetupExistingRepo: () => void;
  selectedCreateWorkspaceId: string | null;
}): {
  onCreateProject: () => void;
  onDiscoverExistingRepo: () => void;
  onGenerateWorkflow: () => void;
  onSetupExistingRepo: () => void;
} {
  if (input.guest) {
    return {
      onCreateProject: input.sendGuestToSignup,
      onDiscoverExistingRepo: input.sendGuestToSignup,
      onGenerateWorkflow: input.sendGuestToSignup,
      onSetupExistingRepo: input.sendGuestToSignup,
    };
  }
  return {
    onCreateProject: () => void input.handleCreateProject(input.selectedCreateWorkspaceId ?? undefined),
    onDiscoverExistingRepo: input.handleDiscoverExistingRepo,
    onGenerateWorkflow: input.handleGenerateWorkflow,
    onSetupExistingRepo: input.handleSetupExistingRepo,
  };
}
