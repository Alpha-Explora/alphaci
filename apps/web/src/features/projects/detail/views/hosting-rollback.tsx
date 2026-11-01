"use client";

import { useState } from "react";

import { FormDialog } from "@/features/groups/workspace";
import type {
  DeploymentRollbackHold,
  DeploymentTarget,
  ProjectDeploymentHistoryItem,
} from "@/shared/api/contracts";
import { deployedAgo, shortCommitSha } from "../../model/projects-rules";
import {
  ROLLBACK_REASON_MAX,
  rollbackConsequence,
  rollbackReasonProblem,
} from "../model/deploy-rollback-rules";

/** What the Hosting card needs to offer Roll back and Resume deploys. */
export interface RollbackControls {
  /** Whether this deploy row offers Roll back. */
  offers: (deploy: ProjectDeploymentHistoryItem) => boolean;
  /** The Vercel rollback holding new production deploys, if any. */
  hold: DeploymentRollbackHold | null;
  /** Whether this viewer may resume the hold. */
  canResume: boolean;
  busy: boolean;
  /** Null on success, else the sentence to show. */
  rollback: (deploy: ProjectDeploymentHistoryItem, reason: string) => Promise<string | null>;
  resume: () => Promise<string | null>;
}

/** The small "Roll back" action at the end of a deploy row. */
export function RollbackButton({
  deploy,
  onSelect,
}: Readonly<{ deploy: ProjectDeploymentHistoryItem; onSelect: (deploy: ProjectDeploymentHistoryItem) => void }>) {
  const sha = shortCommitSha(deploy.commitSha);
  return (
    <button
      type="button"
      className="hosting-row__rollback"
      aria-label={sha ? `Roll back to ${sha}` : "Roll back to this deploy"}
      onClick={() => onSelect(deploy)}
    >
      Roll back
    </button>
  );
}

function DeployIdentity({ deploy }: Readonly<{ deploy: ProjectDeploymentHistoryItem }>) {
  const sha = shortCommitSha(deploy.commitSha);
  return (
    <p className="hosting-rollback__deploy">
      {sha ? <code className="hosting-mono">{sha}</code> : null}
      {deploy.commitMessage ? <span className="hosting-rollback__message">{deploy.commitMessage}</span> : null}
      <span className="hosting-quiet">deployed {deployedAgo(deploy.createdAt)}</span>
    </p>
  );
}

/**
 * Asks once before an earlier deploy goes back live: which one, why (required,
 * kept in the Audit trail), and what it does and does not change.
 */
export function RollbackDialog({
  target,
  deploy,
  controls,
  onClose,
}: Readonly<{
  target: DeploymentTarget;
  deploy: ProjectDeploymentHistoryItem | null;
  controls: RollbackControls;
  onClose: () => void;
}>) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const problem = rollbackReasonProblem(reason);

  async function submit() {
    if (!deploy || problem) return;
    const failure = await controls.rollback(deploy, reason);
    if (failure) {
      setError(failure);
      return;
    }
    setReason("");
    setError(null);
    onClose();
  }

  return (
    <FormDialog
      open={deploy !== null}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title={`Roll back ${target.providerProjectName}`}
      description="Put this earlier deploy back live. Nothing is built again."
      submitLabel="Roll back"
      submitting={controls.busy}
      canSubmit={problem === null}
      error={error}
      onSubmit={() => void submit()}
    >
      {deploy ? <DeployIdentity deploy={deploy} /> : null}
      <label className="hier-field">
        <span className="hier-field-label">
          Reason <span className="qa-required">(required)</span>
        </span>
        <textarea
          className="hier-textarea"
          rows={3}
          maxLength={ROLLBACK_REASON_MAX}
          value={reason}
          disabled={controls.busy}
          aria-required="true"
          placeholder="What is wrong with the live deploy"
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <p className="hosting-quiet">{rollbackConsequence(target.provider, deploy?.branch ?? target.branchName)}</p>
    </FormDialog>
  );
}

/** While a Vercel rollback holds production: what is live, why, and Resume deploys. */
export function RollbackHoldBanner({ controls }: Readonly<{ controls: RollbackControls }>) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hold = controls.hold;
  if (!hold) return null;
  const sha = shortCommitSha(hold.commitSha);

  async function resume() {
    const failure = await controls.resume();
    if (failure) {
      setError(failure);
      return;
    }
    setError(null);
    setConfirming(false);
  }

  return (
    <div className="hosting-hold" role="status">
      <p className="hosting-hold__text">
        <strong>Rolled back</strong> to {sha ? <code className="hosting-mono">{sha}</code> : "an earlier deploy"}
        {hold.rolledBackAt ? ` ${deployedAgo(hold.rolledBackAt)}` : ""}
        {hold.reason ? `: ${hold.reason}` : ""}. New production deploys wait until deploys are resumed.
      </p>
      {controls.canResume ? (
        <button type="button" className="ghost-button hosting-hold__resume" onClick={() => setConfirming(true)}>
          Resume deploys
        </button>
      ) : null}
      <FormDialog
        open={confirming}
        onClose={() => {
          setError(null);
          setConfirming(false);
        }}
        title="Resume deploys"
        description="The newest production deploy goes live again, and new production deploys reach the site."
        submitLabel="Resume deploys"
        submitting={controls.busy}
        error={error}
        onSubmit={() => void resume()}
      >
        <p className="hosting-quiet">
          If the newest deploy is the one you rolled back from, merge the fix or a revert first.
        </p>
      </FormDialog>
    </div>
  );
}
