"use client";

import { MotionConfig, motion, useReducedMotion } from "framer-motion";

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

export function WorkflowBuilder({ guest = false, session, onboardingCompleted }: Readonly<WorkflowBuilderProps>) {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = prefersReducedMotion ?? false;

  const vm = useWorkflowStudioViewModel({ guest, session, onboardingCompleted });
  const {
    activeTab, setActiveTab, statusMessage, isCreatingProject, isDiscoveringExistingRepo, isSettingUpExistingRepo,
    createResult, existingRepoDiscovery, existingRepoResult, setupMode, setSetupMode,
    existingRepoFullName, setExistingRepoFullName, existingRepoBaseBranch, setExistingRepoBaseBranch,
    workspaces, selectedCreateWorkspaceId, setSelectedCreateWorkspaceId,
    handleTabKeyDown, handleStudioTabChange, openIndividualSetup,
    handleCreateProject, handleDiscoverExistingRepo, handleSetupExistingRepo, handleGenerateWorkflow,
    catalog, projectCatalog, projects, createForm, deploymentProvisioning,
    deploymentOwnershipMode, envProvisioningEnabled, github, startTour, startCurrentProjectsTour,
  } = vm;
  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "never"}>
      <GeneratingOverlay isVisible={isCreatingProject} />
      <section className="workflow-surface">
        {/* Status bar — compact, only shows when needed */}
        {(statusMessage || catalog.catalogError || projectCatalog.projectOptionsError) && (
          <div style={{ padding: "0.5rem var(--layout-gutter) 0" }}>
            {statusMessage && (
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
            )}
            {catalog.catalogError && (
              <div className="error-inline" role="alert">
                <span className="error-inline-icon" aria-hidden="true">⚠</span>
                <p className="error-inline-msg">{catalog.catalogError}</p>
              </div>
            )}
            {projectCatalog.projectOptionsError && (
              <div className="error-inline" role="alert">
                <span className="error-inline-icon" aria-hidden="true">⚠</span>
                <p className="error-inline-msg">{projectCatalog.projectOptionsError}</p>
              </div>
            )}
          </div>
        )}

        {/* Tab bar — GitHub App status sits right-aligned on the same row */}
        <WorkflowStudioTabs
          activeTab={activeTab}
          onChange={handleStudioTabChange}
          onKeyDown={handleTabKeyDown}
          trailing={
            <>
              {!guest && activeTab === "setup" ? (
                <button
                  type="button"
                  className="gh-app-install-link"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  aria-label="Show guided tour for the Create Project form"
                  onClick={startTour}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">

                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Show guide
                </button>
              ) : null}
              {!guest && activeTab === "current" ? (
                <button
                  type="button"
                  className="gh-app-install-link"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  aria-label="Show guided tour for Current Projects"
                  onClick={startCurrentProjectsTour}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Show guide
                </button>
              ) : null}
            </>
          }
        />

        {/* Tab content — Setup manages its own full-bleed layout; the other
            tabs need the page gutter so cards don't touch the viewport edges */}
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
              onCreateProject={guest ? () => { window.location.href = "/signup"; } : () => void handleCreateProject(selectedCreateWorkspaceId ?? undefined)}
              onDiscoverExistingRepo={guest ? () => { window.location.href = "/signup"; } : handleDiscoverExistingRepo}
              onGenerateWorkflow={guest ? () => { window.location.href = "/signup"; } : handleGenerateWorkflow}
              onSetupExistingRepo={guest ? () => { window.location.href = "/signup"; } : handleSetupExistingRepo}
              creationScope="choose-team"
              workspaces={workspaces}
              selectedWorkspaceId={selectedCreateWorkspaceId}
              onChangeWorkspace={setSelectedCreateWorkspaceId}
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
                  onCreateProject={guest ? () => { window.location.href = "/signup"; } : () => void handleCreateProject(selectedGroupId, onComplete)}
                  onDiscoverExistingRepo={guest ? () => { window.location.href = "/signup"; } : handleDiscoverExistingRepo}
                  onGenerateWorkflow={guest ? () => { window.location.href = "/signup"; } : handleGenerateWorkflow}
                  onSetupExistingRepo={guest ? () => { window.location.href = "/signup"; } : handleSetupExistingRepo}
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
