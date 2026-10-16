"use client";

import "./requirements.css";

import { useState, type ReactNode } from "react";

import type { AppRole } from "@/shared/api/contracts";

import { ProjectMyItemsCard } from "../../returned";
import { ProjectRunPanel, useProjectRunViewModel } from "../../studio";
import { CHECKLIST_VIEW_LABELS, checklistViewFor } from "../../model/checklist-view-rules";
import { lockedIterationNumber } from "../../model/iteration-rules";
import { canSetVerification } from "../../model/requirement-rules";
import { showsRepositories } from "../../model/studio-role-rules";
import { ProjectRequirementsPanel } from "./project-requirements-panel";

/** The QA run's one line for this viewer, in Project words for those who never see repositories. */
function runRoleLine(appRole: AppRole | null | undefined): string {
  if (canSetVerification(appRole)) {
    return showsRepositories(appRole)
      ? "Verify every item against the uat head of each repository, then sign the Project off."
      : "Verify every item on the Project's uat build, then sign the Project off.";
  }
  return "What the QA Team verified, on which uat heads. Merging to main follows its sign-off.";
}

function RunView({
  deliveryProjectId,
  appRole,
  onOpenHistory,
}: Readonly<{ deliveryProjectId: string; appRole: AppRole | null | undefined; onOpenHistory?: () => void }>) {
  const vm = useProjectRunViewModel({ deliveryProjectId, enabled: true });
  // A delivered iteration's run has left this view; the role line goes with it.
  const delivered = vm.run !== null && lockedIterationNumber(vm.run.iteration) !== null;
  return (
    <>
      {delivered ? null : <p className="rq-panel__role">{runRoleLine(appRole)}</p>}
      <ProjectRunPanel deliveryProjectId={deliveryProjectId} vm={vm} appRole={appRole} onOpenHistory={onOpenHistory} />
    </>
  );
}

/**
 * Everything QA about one Project, as the ONE view this viewer's role works
 * (`checklistViewFor`): a Product owner's Requirements (written by them, with
 * every item's progress), a Developer's Checklist (the same Features, each
 * item's Progress to move, and what QA sent back on top), or the QA Team's
 * run. Mounted by the Project detail screens; it owns its view-models.
 */
export function ProjectQaWorkspace({
  deliveryProjectId,
  projectName,
  appRole,
  enabled = true,
  newFeatureRequest = 0,
  onFeatureCount,
  itemsFallback,
  onOpenHistory,
}: Readonly<{
  deliveryProjectId: string;
  projectName: string;
  appRole: AppRole | null | undefined;
  enabled?: boolean;
  /** Grows each time someone asks to add a Feature here (the "Add a Feature" nudge): New Feature opens. */
  newFeatureRequest?: number;
  /** The Project's live Feature count, each time the Requirements view reads it. */
  onFeatureCount?: (count: number) => void;
  /** Stands in for what QA sent back when the server has no Project-wide list (an older backend). */
  itemsFallback?: ReactNode;
  /** Opens the page's History tab (the repository page); omitted where there is none. */
  onOpenHistory?: () => void;
}>) {
  const [seenRequest, setSeenRequest] = useState(newFeatureRequest);
  // The request the Requirements view still has to act on, so a revisit never reopens the dialog.
  const [pendingRequest, setPendingRequest] = useState(newFeatureRequest);
  // State derived from a changing prop, applied while rendering.
  if (newFeatureRequest !== seenRequest) {
    setSeenRequest(newFeatureRequest);
    setPendingRequest(newFeatureRequest);
  }
  if (!enabled || !deliveryProjectId) return null;
  const view = checklistViewFor(appRole);

  return (
    <section className="rq-workspace" aria-label={`QA for ${projectName}`} data-view={view}>
      <div className="rq-tabpanel" role="region" aria-label={CHECKLIST_VIEW_LABELS[view]}>
        {/* Between iterations the requirements say so themselves, with Start iteration N+1 for an author. */}
        {view === "author" ? (
          <ProjectRequirementsPanel
            deliveryProjectId={deliveryProjectId}
            appRole={appRole}
            newFeatureRequest={pendingRequest}
            onFeatureCount={onFeatureCount}
            onOpenHistory={onOpenHistory}
          />
        ) : null}
        {view === "qa" ? (
          <RunView deliveryProjectId={deliveryProjectId} appRole={appRole} onOpenHistory={onOpenHistory} />
        ) : null}
        {view === "developer" ? (
          <>
            <ProjectMyItemsCard
              deliveryProjectId={deliveryProjectId}
              enabled
              appRole={appRole}
              fallback={itemsFallback}
              returnedOnly
            />
            <ProjectRequirementsPanel deliveryProjectId={deliveryProjectId} appRole={appRole} onOpenHistory={onOpenHistory} />
          </>
        ) : null}
      </div>
    </section>
  );
}
