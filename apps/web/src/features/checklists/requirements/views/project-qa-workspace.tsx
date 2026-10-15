"use client";

import "./requirements.css";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import type { AppRole } from "@/shared/api/contracts";

import { ProjectMyItemsCard } from "../../returned";
import { ProjectRunPanel, useProjectRunViewModel } from "../../studio";
import { lockedIterationNumber } from "../../model/iteration-rules";
import { projectWorkspaceOpensMyItems } from "../../model/my-qa-items-summary-rules";
import { canSetVerification } from "../../model/requirement-rules";
import { showsRepositories } from "../../model/studio-role-rules";
import { ProjectRequirementsPanel } from "./project-requirements-panel";

export type ProjectQaWorkspaceTab = "requirements" | "run" | "items";
type WorkspaceTab = ProjectQaWorkspaceTab;

const TABS: ReadonlyArray<{ id: WorkspaceTab; label: string }> = [
  { id: "requirements", label: "Requirements" },
  { id: "run", label: "QA run" },
  { id: "items", label: "My QA items" },
];

const ARROW_STEPS: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 };

/**
 * A repository Overview's "Open checklist" links here with `#my-qa-items`
 * (or, where the workspace is embedded in that repository's page, asks for
 * `opensOn: "items"`); otherwise the QA Team lands on the run they verify and
 * everyone else on the requirements. Read once at mount: the workspace only
 * renders client-side, after its Project has loaded.
 */
function firstTab(appRole: AppRole | null | undefined, opensOn: WorkspaceTab | undefined): WorkspaceTab {
  if (opensOn) return opensOn;
  const hash = typeof window === "undefined" ? null : window.location.hash;
  if (projectWorkspaceOpensMyItems(hash)) return "items";
  return appRole === "qa" ? "run" : "requirements";
}

/** The QA run tab's one line for this viewer, in Project words for those who never see repositories. */
function runRoleLine(appRole: AppRole | null | undefined): string {
  if (canSetVerification(appRole)) {
    return showsRepositories(appRole)
      ? "Verify every item against the uat head of each repository, then sign the Project off."
      : "Verify every item on the Project's uat build, then sign the Project off.";
  }
  return "What the QA Team verified, on which uat heads. Merging to main follows its sign-off.";
}

function RunTab({
  deliveryProjectId,
  appRole,
  onOpenHistory,
}: Readonly<{ deliveryProjectId: string; appRole: AppRole | null | undefined; onOpenHistory?: () => void }>) {
  const vm = useProjectRunViewModel({ deliveryProjectId, enabled: true });
  // A delivered iteration's run has left this tab; the role line goes with it.
  const delivered = vm.run !== null && lockedIterationNumber(vm.run.iteration) !== null;
  return (
    <>
      {delivered ? null : <p className="rq-panel__role">{runRoleLine(appRole)}</p>}
      <ProjectRunPanel deliveryProjectId={deliveryProjectId} vm={vm} appRole={appRole} onOpenHistory={onOpenHistory} />
    </>
  );
}

/**
 * Everything QA about one Project, in three tabs: its Requirements (Features
 * and System requirements), its QA run, and the project-wide "My QA items".
 * Mounted by the Project detail screens; it owns its view-models.
 */
export function ProjectQaWorkspace({
  deliveryProjectId,
  projectName,
  appRole,
  enabled = true,
  newFeatureRequest = 0,
  onFeatureCount,
  opensOn,
  itemsFallback,
  onOpenHistory,
}: Readonly<{
  deliveryProjectId: string;
  projectName: string;
  appRole: AppRole | null | undefined;
  enabled?: boolean;
  /**
   * Grows each time someone asks to add a Feature here (the "Add a Feature"
   * nudge): the Requirements tab comes forward and opens New Feature.
   */
  newFeatureRequest?: number;
  /** The Project's live Feature count, each time the Requirements tab reads it. */
  onFeatureCount?: (count: number) => void;
  /** The tab to open on, overriding the role default and the URL hash. Read at mount. */
  opensOn?: WorkspaceTab;
  /** Stands in on "My QA items" when the server has no Project-wide list (an older backend). */
  itemsFallback?: ReactNode;
  /** Opens the page's History tab (the repository page); omitted where there is none. */
  onOpenHistory?: () => void;
}>) {
  const [tab, setTab] = useState<WorkspaceTab>(() => firstTab(appRole, opensOn));
  const [seenRequest, setSeenRequest] = useState(newFeatureRequest);
  // The request the Requirements tab still has to act on; leaving the tab
  // drops it, so coming back never reopens the dialog.
  const [pendingRequest, setPendingRequest] = useState(newFeatureRequest);
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // A new request brings the Requirements tab forward (state derived from a
  // changing prop, applied while rendering).
  if (newFeatureRequest !== seenRequest) {
    setSeenRequest(newFeatureRequest);
    setPendingRequest(newFeatureRequest);
    if (newFeatureRequest > 0) setTab("requirements");
  }
  if (!enabled || !deliveryProjectId) return null;

  function selectTab(next: WorkspaceTab) {
    setTab(next);
    setPendingRequest(0);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = ARROW_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + TABS.length) % TABS.length;
    selectTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <section className="rq-workspace" aria-label={`QA for ${projectName}`}>
      <div className="rq-tabs" role="tablist" aria-label="Project QA">
        {TABS.map((entry, index) => (
          <button
            key={entry.id}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${entry.id}`}
            aria-selected={tab === entry.id}
            aria-controls={`${baseId}-panel-${entry.id}`}
            tabIndex={tab === entry.id ? 0 : -1}
            className="rq-tab"
            onClick={() => selectTab(entry.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div
        className="rq-tabpanel"
        role="tabpanel"
        id={`${baseId}-panel-${tab}`}
        aria-labelledby={`${baseId}-tab-${tab}`}
      >
        {tab === "requirements" ? (
          <ProjectRequirementsPanel
            deliveryProjectId={deliveryProjectId}
            appRole={appRole}
            newFeatureRequest={pendingRequest}
            onFeatureCount={onFeatureCount}
            onOpenHistory={onOpenHistory}
          />
        ) : null}
        {tab === "run" ? (
          <RunTab deliveryProjectId={deliveryProjectId} appRole={appRole} onOpenHistory={onOpenHistory} />
        ) : null}
        {tab === "items" ? (
          <ProjectMyItemsCard
            deliveryProjectId={deliveryProjectId}
            enabled
            appRole={appRole}
            fallback={itemsFallback}
          />
        ) : null}
      </div>
    </section>
  );
}
