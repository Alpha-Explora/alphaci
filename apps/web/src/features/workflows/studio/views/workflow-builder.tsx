"use client";

import { MotionConfig, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";

import { useWorkflowStudioViewModel } from "../view-models/use-workflow-studio-view-model";
import {
  statusBannerVariant,
  type WorkflowTab,
} from "../model/workflow-studio-rules";
import { WorkflowCurrentTab } from "./workflow-current-tab";
import { GeneratingOverlay } from "./generating-overlay";
import { WorkflowSetupTab } from "./workflow-setup-tab";
import { WorkflowStudioTabs } from "./workflow-studio-tabs";

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

function GuideIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function WorkflowStudioGuideLinks({
  guest,
  activeTab,
  onStartTour,
  onStartCurrentProjectsTour,
}: Readonly<{
  guest: boolean;
  activeTab: WorkflowTab;
  onStartTour: () => void;
  onStartCurrentProjectsTour: () => void;
}>) {
  if (guest) return null;
  if (activeTab === "setup") {
    return (
      <button
        type="button"
        className="gh-app-install-link"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        aria-label="Show guided tour for the Create Project form"
        onClick={onStartTour}
      >
        <GuideIcon />
        Show guide
      </button>
    );
  }
  if (activeTab === "current") {
    return (
      <button
        type="button"
        className="gh-app-install-link"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        aria-label="Show guided tour for Current Projects"
        onClick={onStartCurrentProjectsTour}
      >
        <GuideIcon />
        Show guide
      </button>
    );
  }
  return null;
}

export function WorkflowBuilder({ guest = false, session, onboardingCompleted }: Readonly<WorkflowBuilderProps>) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = prefersReducedMotion === true;
  const vm = useWorkflowStudioViewModel({ guest, session, onboardingCompleted });
  const sendGuestToSignup = () => router.push("/signup");
  const {
    activeTab, statusMessage, isCreatingProject, isDiscoveringExistingRepo, isSettingUpExistingRepo,
    createResult, existingRepoDiscovery, existingRepoResult, setupMode, setSetupMode,
    existingRepoFullName, setExistingRepoFullName, existingRepoBaseBranch, setExistingRepoBaseBranch,
    workspaces, selectedCreateWorkspaceId, setSelectedCreateWorkspaceId, targetProjectLabel,
    handleTabKeyDown, handleStudioTabChange, openIndividualSetup,
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
        <WorkflowStudioTabs
          activeTab={activeTab}
          onChange={handleStudioTabChange}
          onKeyDown={handleTabKeyDown}
          trailing={
            <WorkflowStudioGuideLinks
              guest={guest}
              activeTab={activeTab}
              onStartTour={startTour}
              onStartCurrentProjectsTour={startCurrentProjectsTour}
            />
          }
        />
        <div style={activeTab === "setup" ? undefined : { padding: "0.5rem var(--layout-gutter) 2.5rem" }}>
          {activeTab === "setup" ? (
            <WorkflowSetupTab
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
          ) : null}
          {activeTab === "current" ? (
            <WorkflowCurrentTab
              latestResult={createResult}
              loadingProjects={projects.loadingProjects}
              onOpenSetup={openIndividualSetup}
              projects={projects.projects}
              renderGroupCreate={(selectedGroupId, onComplete) => (
                <WorkflowSetupTab
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
                  onCreateProject={guest ? sendGuestToSignup : () => void handleCreateProject(selectedGroupId, onComplete)}
                  onDiscoverExistingRepo={actions.onDiscoverExistingRepo}
                  onGenerateWorkflow={actions.onGenerateWorkflow}
                  onSetupExistingRepo={actions.onSetupExistingRepo}
                  projectCatalog={projectCatalog}
                  creationScope="in-team"
                  onViewProject={onComplete}
                  reducedMotion={reducedMotion}
                  createResult={createResult}
                />
              )}
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
