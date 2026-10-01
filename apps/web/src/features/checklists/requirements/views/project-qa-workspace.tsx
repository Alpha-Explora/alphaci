"use client";

import "./requirements.css";

import { useId, useRef, useState, type KeyboardEvent } from "react";

import type { AppRole } from "@/shared/api/contracts";

import { ProjectMyItemsCard } from "../../returned";
import { ProjectRunPanel, useProjectRunViewModel } from "../../studio";
import { canSetVerification } from "../../model/requirement-rules";
import { ProjectRequirementsPanel } from "./project-requirements-panel";

type WorkspaceTab = "requirements" | "run" | "items";

const TABS: ReadonlyArray<{ id: WorkspaceTab; label: string }> = [
  { id: "requirements", label: "Requirements" },
  { id: "run", label: "QA run" },
  { id: "items", label: "My QA items" },
];

const ARROW_STEPS: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 };

/** The QA Team lands on the run they verify; everyone else on the requirements. */
function firstTab(appRole: AppRole | null | undefined): WorkspaceTab {
  return appRole === "qa" ? "run" : "requirements";
}

function RunTab({
  deliveryProjectId,
  appRole,
}: Readonly<{ deliveryProjectId: string; appRole: AppRole | null | undefined }>) {
  const vm = useProjectRunViewModel({ deliveryProjectId, enabled: true });
  return (
    <>
      <p className="rq-panel__role">
        {canSetVerification(appRole)
          ? "Verify every item against the uat head of each repository, then sign the Project off."
          : "What the QA Team verified, on which uat heads. Merging to main follows its sign-off."}
      </p>
      <ProjectRunPanel deliveryProjectId={deliveryProjectId} vm={vm} appRole={appRole} />
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
}: Readonly<{
  deliveryProjectId: string;
  projectName: string;
  appRole: AppRole | null | undefined;
  enabled?: boolean;
}>) {
  const [tab, setTab] = useState<WorkspaceTab>(() => firstTab(appRole));
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  if (!enabled || !deliveryProjectId) return null;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = ARROW_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + TABS.length) % TABS.length;
    setTab(TABS[next].id);
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
            onClick={() => setTab(entry.id)}
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
        {tab === "requirements" ? <ProjectRequirementsPanel deliveryProjectId={deliveryProjectId} appRole={appRole} /> : null}
        {tab === "run" ? <RunTab deliveryProjectId={deliveryProjectId} appRole={appRole} /> : null}
        {tab === "items" ? (
          <ProjectMyItemsCard deliveryProjectId={deliveryProjectId} enabled appRole={appRole} />
        ) : null}
      </div>
    </section>
  );
}
