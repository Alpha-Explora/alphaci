"use client";

import "./requirements.css";

import { useState } from "react";

import type { AppRole } from "@/shared/api/contracts";

import { ProjectRunPanel, useProjectRunViewModel } from "../../studio";
import { verdictsBySourceItem } from "../../model/checklist-filter-rules";
import { CHECKLIST_VIEW_LABELS, checklistViewFor } from "../../model/checklist-view-rules";
import { ProjectRequirementsPanel } from "./project-requirements-panel";

/** The QA run, with no line above it: the run's own box says who started it and where it stands. */
function RunView({
  deliveryProjectId,
  appRole,
  onOpenHistory,
}: Readonly<{ deliveryProjectId: string; appRole: AppRole | null | undefined; onOpenHistory?: () => void }>) {
  const vm = useProjectRunViewModel({ deliveryProjectId, enabled: true });
  return <ProjectRunPanel deliveryProjectId={deliveryProjectId} vm={vm} appRole={appRole} onOpenHistory={onOpenHistory} />;
}

/**
 * The checklist a Product owner and a Developer share: the Features with each
 * item's Progress and QA's verdict on it from the current run (its notes when
 * it was sent back, failed or blocked), and the chips, whose counts are where
 * the Project stands. What each can change is the requirements panel's (the
 * server's) to decide: the Product owner writes, the Developer moves Progress.
 * No run yet, or an older backend without Project runs, means no verdicts.
 */
function ChecklistWithVerdicts({
  deliveryProjectId,
  appRole,
  onOpenHistory,
  newFeatureRequest,
  onFeatureCount,
}: Readonly<{
  deliveryProjectId: string;
  appRole: AppRole | null | undefined;
  onOpenHistory?: () => void;
  newFeatureRequest?: number;
  onFeatureCount?: (count: number) => void;
}>) {
  const run = useProjectRunViewModel({ deliveryProjectId, enabled: true });
  return (
    <ProjectRequirementsPanel
      deliveryProjectId={deliveryProjectId}
      appRole={appRole}
      newFeatureRequest={newFeatureRequest}
      onFeatureCount={onFeatureCount}
      onOpenHistory={onOpenHistory}
      verdicts={verdictsBySourceItem(run.run)}
      filterable
    />
  );
}

/**
 * Everything QA about one Project, as the ONE view this viewer's role works
 * (`checklistViewFor`): a Product owner's Requirements (written by them, with
 * every item's progress), a Developer's Checklist (the same Features, each
 * item's Progress to move, with QA's verdict on it), or the QA Team's run.
 * Mounted by the Project detail screens; it owns its view-models.
 */
export function ProjectQaWorkspace({
  deliveryProjectId,
  projectName,
  appRole,
  enabled = true,
  newFeatureRequest = 0,
  onFeatureCount,
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
          <ChecklistWithVerdicts
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
          <ChecklistWithVerdicts deliveryProjectId={deliveryProjectId} appRole={appRole} onOpenHistory={onOpenHistory} />
        ) : null}
      </div>
    </section>
  );
}
