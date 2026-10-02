"use client";

import "./requirements.css";

import { motion, useReducedMotion } from "framer-motion";

import { LoadingRows } from "@/features/groups/workspace";
import type { AppRole } from "@/shared/api/contracts";

import { useItemProgressViewModel, type ItemProgressViewModel } from "../../returned";
import {
  canSetVerification,
  kindCopy,
  SHOWN_REQUIREMENT_KINDS,
  type RequirementPermissions,
} from "../../model/requirement-rules";
import type { Requirement, RequirementKind } from "../../model/requirement-types";
import {
  useProjectRequirementsViewModel,
  type ProjectRequirementsViewModel,
} from "../view-models/use-project-requirements-view-model";
import {
  useRequirementDialogViewModel,
  type RequirementDialogViewModel,
} from "../view-models/use-requirement-dialog-view-model";
import { RequirementCard } from "./requirement-card";
import { ArchiveRequirementDialog, RequirementDialog } from "./requirement-dialog";
import { FeatureIcon, PlusIcon, SystemIcon } from "./requirement-icons";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** One line, for the viewer's role: what they do here. */
function roleLine(permissions: RequirementPermissions, appRole: AppRole | null | undefined): string {
  if (permissions.canManage) {
    return "You write the requirements. Developers move each item's Progress; the QA Team verifies them on the Project QA run.";
  }
  if (permissions.canSetProgress) {
    return "Move each item's Progress as you build it. Mark it Done when it is ready for QA.";
  }
  if (canSetVerification(appRole)) {
    return "Developers mark items Done; you verify them on the Project QA run.";
  }
  return "Requirements for every repository in this Project.";
}

function emptyCopy(kind: RequirementKind, canManage: boolean): string {
  const copy = kindCopy(kind);
  if (canManage) {
    return kind === "functional"
      ? "Describe what this Project must do as Features, each told as User stories with acceptance criteria."
      : "Add the checks every repository must pass, such as security or performance baselines.";
  }
  return `${copy.empty} Your Product owner writes them.`;
}

function KindSection({
  kind,
  requirements,
  vm,
  dialog,
  progress,
}: Readonly<{
  kind: RequirementKind;
  requirements: Requirement[];
  vm: ProjectRequirementsViewModel;
  dialog: RequirementDialogViewModel;
  progress: ItemProgressViewModel;
}>) {
  const reduced = useReducedMotion();
  const copy = kindCopy(kind);
  const canManage = vm.permissions.canManage;
  const titleId = `rq-section-${kind}`;
  return (
    <section className="rq-section" data-kind={kind} aria-labelledby={titleId}>
      <div className="rq-section__head">
        <span className="rq-section__icon" aria-hidden="true">
          {kind === "functional" ? <FeatureIcon /> : <SystemIcon />}
        </span>
        <div className="rq-section__titles">
          <h3 className="rq-section__title" id={titleId}>
            {copy.section}
            <span className="rq-count">{requirements.length}</span>
          </h3>
          <p className="rq-section__lede">{copy.lede}</p>
        </div>
        {canManage && requirements.length > 0 ? (
          <button type="button" className="primary-button rq-section__create" onClick={() => dialog.openCreate(kind)}>
            <PlusIcon />
            {copy.create}
          </button>
        ) : null}
      </div>
      {requirements.length === 0 ? (
        <div className="rq-empty">
          <p>{emptyCopy(kind, canManage)}</p>
          {canManage ? (
            <button type="button" className="primary-button" onClick={() => dialog.openCreate(kind)}>
              <PlusIcon />
              {kind === "functional" ? "Add the first Feature" : "Add a System requirement"}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="rq-cards">
          {requirements.map((requirement, index) => (
            <motion.div
              key={requirement.id}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: EASE_OUT, delay: Math.min(index, 5) * 0.05 }}
            >
              <RequirementCard
                requirement={requirement}
                permissions={vm.permissions}
                progress={progress}
                onEdit={dialog.openEdit}
                onArchive={dialog.openArchive}
                onItem={vm.applyItem}
                onRemoved={vm.removeItem}
                onRequirement={vm.applyRequirement}
                onReload={vm.reload}
              />
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * A Project's requirements, one section per shown kind: Functional
 * Requirements (Features, each with its User stories) first, then System
 * requirements when SHOWN_REQUIREMENT_KINDS includes them (hidden for now).
 * Product owners and admins write them; Developers move Progress; the QA
 * Team reads them here and verifies them on the Project QA run.
 */
export function ProjectRequirementsPanel({
  deliveryProjectId,
  appRole,
  enabled = true,
  kinds = SHOWN_REQUIREMENT_KINDS,
}: Readonly<{
  deliveryProjectId: string;
  appRole: AppRole | null | undefined;
  enabled?: boolean;
  /** The sections to show, in order. Defaults to SHOWN_REQUIREMENT_KINDS. */
  kinds?: ReadonlyArray<RequirementKind>;
}>) {
  const vm = useProjectRequirementsViewModel({ deliveryProjectId, enabled, appRole });
  const dialog = useRequirementDialogViewModel({ deliveryProjectId, onSaved: vm.applyRequirement });
  const progress = useItemProgressViewModel({ onSaved: vm.applyItem });

  if (vm.status === "loading") return <LoadingRows rows={3} />;
  if (vm.status === "error" || vm.status === "unavailable") {
    return (
      <div className="hier-state" role={vm.status === "error" ? "alert" : undefined}>
        <h3 className="hier-state-title">Requirements did not load</h3>
        <p className="hier-state-text">{vm.error}</p>
        <button type="button" className="ghost-button" onClick={vm.reload}>
          Try again
        </button>
      </div>
    );
  }
  return (
    <div className="rq-panel">
      <p className="rq-panel__role">{roleLine(vm.permissions, appRole)}</p>
      {kinds.map((kind) => (
        <KindSection
          key={kind}
          kind={kind}
          requirements={kind === "functional" ? vm.functional : vm.system}
          vm={vm}
          dialog={dialog}
          progress={progress}
        />
      ))}
      {vm.permissions.canManage ? (
        <>
          <RequirementDialog vm={dialog} />
          <ArchiveRequirementDialog vm={dialog} />
        </>
      ) : null}
    </div>
  );
}
