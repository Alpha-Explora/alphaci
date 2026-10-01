"use client";

import "./qa-studio.css";
import "./project-run.css";

import type { ReactNode } from "react";

import type { AppRole } from "@/shared/api/contracts";

import { kindCopy } from "../../model/requirement-rules";
import {
  canStartProjectRun,
  groupRunItems,
  headChangeMessage,
  headChangeMessages,
  headLabel,
  REQUIREMENTS_CHANGED_NOTE,
  repositoriesLabel,
  requirementsChangedLabel,
  resolveProjectRunPermissions,
  STALE_RUN_NOTE,
} from "../../model/project-run-rules";
import type { HeadStatus, ProjectQaRun } from "../../model/project-run-types";
import { agoLabel, shortSha } from "../../model/qa-run-rules";
import type { ProjectRunViewModel } from "../view-models/use-project-run-view-model";
import {
  useProjectReopenViewModel,
  useProjectSignoffViewModel,
} from "../view-models/use-project-signoff-view-model";
import { useProjectVerificationViewModel } from "../view-models/use-project-verification-view-model";
import { ProjectRunItem } from "./project-run-item";
import { RunSummary, SignoffBanner, SignoffDialog, SignoffFooter } from "./run-signoff";

function PanelState({
  title,
  text,
  tone,
  children,
}: Readonly<{ title: string; text: string; tone?: "danger"; children?: ReactNode }>) {
  return (
    <div className={`qa-panel-state${tone ? ` qa-panel-state--${tone}` : ""}`} role={tone ? "alert" : undefined}>
      <h3 className="qa-panel-state__title">{title}</h3>
      <p className="qa-panel-state__text">{text}</p>
      {children}
    </div>
  );
}

function RunSkeleton() {
  return (
    <div className="qa-run-skeleton" aria-hidden="true">
      <span className="hier-skeleton qa-run-skeleton__bar" />
      {[0, 1, 2].map((row) => (
        <span key={row} className="hier-skeleton qa-run-skeleton__row" />
      ))}
    </div>
  );
}

/** Every repository's uat head: now, and (with a run) what the run captured. */
function HeadsList({ heads, withRun }: Readonly<{ heads: HeadStatus[]; withRun: boolean }>) {
  if (heads.length === 0) return null;
  return (
    <ul className="pqa-heads" aria-label="uat heads of this Project's repositories">
      {heads.map((head) => {
        const change = withRun ? headChangeMessage(head) : null;
        return (
          <li key={head.projectId} className="pqa-head" data-changed={change ? "true" : "false"}>
            <span className="pqa-head__name">{headLabel(head.repoFullName, null)}</span>
            <code className="pqa-head__sha">
              uat @ {shortSha(head.currentSha) || "unknown"}
              {withRun && head.runSha && head.runSha !== head.currentSha ? ` (run: ${shortSha(head.runSha)})` : ""}
            </code>
            {change ? <span className="pqa-head__change">{change}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

function StartButton({ vm, label }: Readonly<{ vm: ProjectRunViewModel; label: string }>) {
  const starting = vm.status === "starting";
  return (
    <>
      <button type="button" className="primary-button" disabled={starting} onClick={() => void vm.start()}>
        {starting ? "Starting…" : label}
      </button>
      {vm.startError ? (
        <p className="qa-form-error" role="alert">
          {vm.startError.message}
        </p>
      ) : null}
    </>
  );
}

/** No run on the current heads yet: start one, or say who can. */
/** No run on the current heads, but an earlier one exists: say what moved since it. */
function MovedSinceLatest({ vm }: Readonly<{ vm: ProjectRunViewModel }>) {
  const messages = vm.stale ? headChangeMessages(vm.heads) : [];
  if (messages.length === 0) return null;
  return (
    <div className="pqa-alert pqa-alert--warning" role="status">
      <p className="pqa-alert__title">uat moved since the latest Project run</p>
      <ul className="pqa-alert__list">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

function StartProjectRun({ vm, appRole }: Readonly<{ vm: ProjectRunViewModel; appRole: AppRole | null | undefined }>) {
  const count = vm.heads.length;
  if (!canStartProjectRun(appRole)) {
    return (
      <PanelState
        title="No Project QA run yet"
        text="QA Team members, Product owners and admins start the Project's QA run. Once one starts, its items and results appear here."
      >
        <MovedSinceLatest vm={vm} />
        <HeadsList heads={vm.heads} withRun={false} />
      </PanelState>
    );
  }
  return (
    <PanelState
      title="Verify this Project"
      text={`A run captures the uat head of every repository in this Project${count > 0 ? ` (${repositoriesLabel(count)})` : ""} and snapshots every requirement, so QA verifies them together.`}
    >
      <MovedSinceLatest vm={vm} />
      <HeadsList heads={vm.heads} withRun={false} />
      <StartButton vm={vm} label="Start Project QA run" />
    </PanelState>
  );
}

function StaleNotice({
  vm,
  run,
  appRole,
}: Readonly<{ vm: ProjectRunViewModel; run: ProjectQaRun; appRole: AppRole | null | undefined }>) {
  if (!run.stale && !vm.stale) return null;
  const messages = headChangeMessages(vm.heads.length > 0 ? vm.heads : run.repositories);
  return (
    <div className="pqa-alert pqa-alert--warning" role="status">
      <p className="pqa-alert__title">This run is stale</p>
      {messages.length > 0 ? (
        <ul className="pqa-alert__list">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      <p className="pqa-alert__text">{STALE_RUN_NOTE}</p>
      {canStartProjectRun(appRole) ? <StartButton vm={vm} label="Start a run on the current heads" /> : null}
    </div>
  );
}

function RequirementsChangedNotice({ run, changed }: Readonly<{ run: ProjectQaRun; changed: boolean }>) {
  if (!changed && !run.requirementsChanged) return null;
  return (
    <div className="pqa-alert pqa-alert--info" role="status">
      <p className="pqa-alert__title">{requirementsChangedLabel(run)}</p>
      <p className="pqa-alert__text">{REQUIREMENTS_CHANGED_NOTE}</p>
    </div>
  );
}

function RunHead({ run }: Readonly<{ run: ProjectQaRun }>) {
  const ago = agoLabel(run.createdAt);
  return (
    <p className="qa-run-card__started">
      {run.createdBy ? (
        <>
          Started by <strong>@{run.createdBy.login}</strong>
        </>
      ) : (
        "Started"
      )}
      {ago ? ` · ${ago}` : ""} · {repositoriesLabel(run.repositories.length)} · {run.items.length}{" "}
      {run.items.length === 1 ? "item" : "items"}
    </p>
  );
}

function signedSubject(run: ProjectQaRun): string {
  if (run.repositories.length === 0) return run.deliveryProjectName;
  return run.repositories.map((head) => headLabel(head.repoFullName, head.runSha)).join(", ");
}

/** Where each group's numbering starts, so items count 01, 02… across the whole run. */
function groupOffsets(groups: ReadonlyArray<{ items: ReadonlyArray<unknown> }>): number[] {
  const offsets: number[] = [];
  let next = 0;
  for (const group of groups) {
    offsets.push(next);
    next += group.items.length;
  }
  return offsets;
}

/** A run and everything that can be done to it. Mounted (and keyed) once a run exists. */
function RunBody({
  deliveryProjectId,
  vm,
  run,
  appRole,
}: Readonly<{ deliveryProjectId: string; vm: ProjectRunViewModel; run: ProjectQaRun; appRole: AppRole | null | undefined }>) {
  const permissions = resolveProjectRunPermissions(run, appRole);
  const editor = useProjectVerificationViewModel({
    deliveryProjectId,
    run,
    permissions,
    onRun: vm.applyRun,
    onReload: vm.reload,
  });
  const signoff = useProjectSignoffViewModel({ deliveryProjectId, run, permissions, onRun: vm.applyRun });
  const reopen = useProjectReopenViewModel({ deliveryProjectId, run, permissions, onRun: vm.applyRun });
  const groups = groupRunItems(run.items);
  const offsets = groupOffsets(groups);

  return (
    <div className="qa-run pqa-run__body">
      <RunHead run={run} />
      <StaleNotice vm={vm} run={run} appRole={appRole} />
      <RequirementsChangedNotice run={run} changed={vm.requirementsChanged} />
      <SignoffBanner run={run} subject={signedSubject(run)} reopen={reopen} />
      <HeadsList heads={vm.heads.length > 0 ? vm.heads : run.repositories} withRun />
      <RunSummary run={run} />
      {groups.length === 0 ? <p className="pqa-note">This run has no items.</p> : null}
      {groups.map((group, groupIndex) => (
        <section key={group.key} className="pqa-group" aria-label={`${kindCopy(group.kind).singular}: ${group.requirementName}`}>
          <h4 className="pqa-group__title">
            <span className="pqa-kind" data-kind={group.kind}>
              {kindCopy(group.kind).singular}
            </span>
            {group.requirementName}
          </h4>
          <ol className="qa-run__items">
            {group.items.map((item, itemIndex) => (
              <ProjectRunItem
                key={item.id}
                item={item}
                index={offsets[groupIndex] + itemIndex}
                editor={editor}
                onReload={vm.reload}
              />
            ))}
          </ol>
        </section>
      ))}
      {run.status === "open" ? <SignoffFooter vm={signoff} /> : null}
      {signoff.canSignOff ? <SignoffDialog vm={signoff} description={`${run.deliveryProjectName} on ${signedSubject(run)}`} /> : null}
    </div>
  );
}

/**
 * A Project's QA run: every repository's uat head, the run that covers them,
 * and — for the QA Team, Product owners and admins — Verification and
 * sign-off. Developers see the same run read-only. `fallback` renders when
 * the server has no Project runs yet (an older backend).
 */
export function ProjectRunPanel({
  deliveryProjectId,
  vm,
  appRole,
  fallback,
}: Readonly<{
  deliveryProjectId: string;
  vm: ProjectRunViewModel;
  appRole: AppRole | null | undefined;
  fallback?: ReactNode;
}>) {
  let body: ReactNode;
  if (vm.status === "idle" || vm.status === "loading") body = <RunSkeleton />;
  else if (vm.status === "unavailable") {
    body = fallback ?? (
      <PanelState title="Project QA runs are not available" text="This server does not offer Project QA runs yet." />
    );
  } else if (vm.status === "error") {
    body = (
      <PanelState title="The Project QA run did not load" text={vm.error ?? ""} tone="danger">
        <button type="button" className="ghost-button" onClick={vm.reload}>
          Try again
        </button>
      </PanelState>
    );
  } else if (!vm.run) body = <StartProjectRun vm={vm} appRole={appRole} />;
  else {
    // Keyed by run: a reopened or newly started run gets fresh drafts and dialogs.
    body = <RunBody key={vm.run.id} deliveryProjectId={deliveryProjectId} vm={vm} run={vm.run} appRole={appRole} />;
  }
  return <div className="pqa-run">{body}</div>;
}
