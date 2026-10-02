"use client";

import type { QaScope } from "@/features/checklists";
import { MyQaItemsSummary } from "@/features/checklists/returned";
import { ProductionReadinessCard } from "@/features/checklists/studio";
import { ProductionDeploymentPanel } from "@/features/projects/previews";
import type { ProvisionedProject } from "@/features/projects";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { showOverviewProductionReadiness } from "../model/project-detail-tab-rules";
import { CloneCard } from "./clone-card";

/**
 * The repository Overview, the same for every role: what is live (branch
 * previews), how to clone it (HTTPS / SSH / GitHub CLI, since users never
 * open GitHub), how many QA items wait on whom (a summary; the full list is one
 * click away), the read-only production readiness card for Developers, and
 * why provisioning failed when it did. Configuration facts, health checks and
 * drift used to live here; they were noise on the first screen.
 */
export function OverviewTab({
  project,
  vm,
  qaScope,
}: Readonly<{
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
  dangerZone?: React.ReactNode;
  qaScope?: QaScope;
}>) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <OverviewPreviews
        enabled={vm.previewDeploymentsEnabled}
        // "Full logs" opens the Hosting tab; a role without it (a Product
        // owner) keeps the card's own log surface only.
        onOpenFullLogs={vm.visibleTabs.includes("hosting") ? vm.openTargetLogs : undefined}
        project={project}
      />
      <CloneCard repoFullName={project.repoFullName} repoUrl={project.repoUrl} />
      <MyQaItemsSummary
        enabled={vm.qaChecklistsEnabled && Boolean(vm.appRole)}
        projectId={project.id}
        highlightRequested={vm.highlightMyQaItems}
        qaScope={qaScope}
        onOpenChecklists={() => vm.setTab("checklists")}
      />
      {showOverviewProductionReadiness(vm.appRole, vm.qaChecklistsEnabled) ? (
        <ProductionReadinessCard
          enabled
          projectId={project.id}
          projectName={project.serviceName}
        />
      ) : null}
      <ErrorText message={project.failureReason} />
    </div>
  );
}

/** First on the Overview: what is live is the first question asked of a project. */
function OverviewPreviews({
  enabled,
  onOpenFullLogs,
  project,
}: Readonly<{
  enabled: boolean;
  onOpenFullLogs: ProjectDetailTabsViewModel["openTargetLogs"] | undefined;
  project: ProvisionedProject;
}>) {
  if (!enabled) return null;
  return (
    <ProductionDeploymentPanel
      enabled
      onOpenFullLogs={onOpenFullLogs}
      projectId={project.id}
      repoFullName={project.repoFullName}
    />
  );
}

function ErrorText({ message }: Readonly<{ message: string | null }>) {
  if (!message) return null;
  return (
    <p className="error-text" style={{ margin: 0 }}>
      {message}
    </p>
  );
}
