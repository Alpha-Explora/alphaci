"use client";

import { useId } from "react";

import type { AppRole } from "@/shared/api/contracts";
import {
  selectableBaseBranches,
  selectableHeadBranches,
} from "../../model/pull-request-compose-rules";
import { DiffView } from "./diff-view";
import { WorkspaceError, WorkspaceLoading } from "./workspace-states";
import {
  useCreatePullRequestViewModel,
  type BranchComparisonResponse,
  type ComposeReadiness,
  type CreatePullRequestViewModel,
  type PullRequestSummary,
} from "../../view-models/use-create-pull-request-view-model";

/**
 * Propose merging one branch into another, without leaving the product.
 *
 * The comparison is shown before anything is written, so the person sees
 * exactly what the pull request will contain — and is told why not, when
 * GitHub would refuse it — before they spend time on a description.
 */
export function CreatePullRequestView({
  projectId,
  appRole,
  viewerLogin,
  onCancel,
  onCreated,
  onViewExisting,
}: Readonly<{
  projectId: string;
  /** The viewer's app role. QA does not open pull requests. */
  appRole?: AppRole;
  /** The viewer's GitHub login, to find their own branches for the presets. */
  viewerLogin?: string | null;
  onCancel: () => void;
  onCreated: (pullRequest: PullRequestSummary) => void;
  /** Leave compose for a pull request that is already open for this pair. */
  onViewExisting: (pullNumber: number) => void;
}>) {
  // Called unconditionally regardless of role — QA reaches this component
  // only through a stale UI state or a direct link, and skipping the hook
  // for that case would break the rules of hooks for one defensive path.
  const vm = useCreatePullRequestViewModel({
    projectId,
    appRole,
    viewerLogin,
    onCreated,
  });

  return (
    <section className="ws-compose" aria-labelledby="ws-compose-title">
      <div className="ws-toolbar ws-toolbar--between">
        <h3 id="ws-compose-title" className="ws-compose__title">
          New pull request
        </h3>
        <button type="button" className="ws-link" onClick={onCancel}>
          Cancel
        </button>
      </div>

      {appRole === "qa" ? (
        <p className="ws-hint" role="status">
          QA does not open pull requests.
        </p>
      ) : vm.status === "loading" ? (
        <WorkspaceLoading rows={3} />
      ) : (
        <>
          <PresetPicker vm={vm} />
          <BranchPickers vm={vm} appRole={appRole} />
          <ComposeBody vm={vm} onViewExisting={onViewExisting} />
        </>
      )}
    </section>
  );
}

/**
 * The common pull requests as one choice, above the free pickers. Native
 * radios in a named group, so arrow keys and screen readers behave as they
 * should; an unavailable preset is disabled and says why in text.
 */
function PresetPicker({ vm }: Readonly<{ vm: CreatePullRequestViewModel }>) {
  const groupId = useId();
  if (vm.presets.length === 0) return null;
  const busy = vm.status === "submitting";

  return (
    <div
      className="ws-preset"
      role="radiogroup"
      aria-label="Pull request type"
    >
      {vm.presets.map((preset) => {
        const reasonId = `${groupId}-${preset.id}-reason`;
        return (
          <label
            key={preset.id}
            className="ws-preset__option"
            data-checked={vm.preset === preset.id ? "true" : "false"}
            data-disabled={preset.available ? "false" : "true"}
          >
            <input
              type="radio"
              className="ws-preset__input"
              name={groupId}
              value={preset.id}
              checked={vm.preset === preset.id}
              disabled={busy || !preset.available}
              aria-describedby={preset.reason ? reasonId : undefined}
              onChange={() => vm.selectPreset(preset.id)}
            />
            <span className="ws-preset__label">{preset.label}</span>
            {preset.reason && (
              <span id={reasonId} className="ws-preset__reason">
                {preset.reason}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}

function BranchPickers({
  vm,
  appRole,
}: Readonly<{ vm: CreatePullRequestViewModel; appRole?: AppRole }>) {
  const busy = vm.status === "submitting";
  // A preset fixes the base; Feature → Dev leaves the head to the person, and
  // Dev → UAT fixes both. Only Custom (or no presets at all, e.g. QA) is free.
  const presetOn = vm.presets.length > 0 && vm.preset !== "custom";
  const baseLocked = presetOn;
  const headLocked = presetOn && vm.preset === "dev-to-uat";
  // `main` is never a selectable base: Hop 3 is locked to the promotion
  // engine and QA Studio, not this composer, for every role.
  const baseOptions = selectableBaseBranches(vm.branches, appRole);
  // A Developer only picks a feature branch (into dev) or dev (into uat).
  const headOptions = selectableHeadBranches(vm.branches, appRole, vm.base);
  // Swapping only does something in Custom: a preset fixes the pair.
  const canSwap = !presetOn && appRole !== "member";

  return (
    <div className="ws-compose__branches">
      <label className="ws-compose__branch">
        <span className="ws-branch__label">Merge into</span>
        <select
          className="ws-select"
          value={vm.base}
          disabled={busy || baseLocked}
          onChange={(event) => vm.setBase(event.target.value)}
        >
          {baseOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      {/* Reads as the merge does: the From branch flows into the base. */}
      <span className="ws-compose__direction" aria-hidden="true">
        ←
      </span>

      <label className="ws-compose__branch">
        <span className="ws-branch__label">From</span>
        <select
          className="ws-select"
          value={vm.head}
          disabled={busy || headLocked}
          onChange={(event) => vm.setHead(event.target.value)}
        >
          <option value="" disabled>
            Choose a branch…
          </option>
          {headOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      {canSwap && (
        <button
          type="button"
          className="ws-compose__swap"
          onClick={vm.swapBranches}
          disabled={busy || !vm.head}
          aria-label="Swap the two branches"
          title="Swap the two branches"
        >
          ⇄ Swap
        </button>
      )}
    </div>
  );
}

function ComposeBody({
  vm,
  onViewExisting,
}: Readonly<{
  vm: CreatePullRequestViewModel;
  onViewExisting: (pullNumber: number) => void;
}>) {
  if (vm.status === "error") {
    return (
      <WorkspaceError
        message={vm.error ?? "Something went wrong."}
        onRetry={vm.retry}
      />
    );
  }

  if (vm.status === "choosing") {
    return (
      <p className="ws-hint">
        Choose the branch that has your changes to see what the pull request
        would contain.
      </p>
    );
  }

  if (vm.status === "comparing" || !vm.compare || !vm.readiness) {
    return <WorkspaceLoading rows={3} />;
  }

  const canCreate = vm.readiness.canCreate;
  const fileCount = vm.compare.comparison.files.length;

  return (
    <>
      <ReadinessBanner
        readiness={vm.readiness}
        onSwap={vm.swapBranches}
        onViewExisting={onViewExisting}
      />
      <div
        className={`ws-compose__layout${canCreate ? " ws-compose__layout--split" : ""}`}
      >
        {canCreate && <ComposeForm vm={vm} />}
        <ComparisonSummary compare={vm.compare} />
      </div>
      <section className="ws-compose__files" aria-labelledby="ws-compose-files">
        <h4 id="ws-compose-files" className="ws-compose__subtitle">
          Files changed · {fileCount}
        </h4>
        <DiffView
          files={vm.compare.comparison.files}
          truncated={vm.compare.comparison.filesTruncated}
        />
      </section>
    </>
  );
}

function ReadinessBanner({
  readiness,
  onSwap,
  onViewExisting,
}: Readonly<{
  readiness: ComposeReadiness;
  onSwap: () => void;
  onViewExisting: (pullNumber: number) => void;
}>) {
  if (!readiness.message) return null;
  const { action } = readiness;

  return (
    <div
      className={`ws-compose__banner ws-compose__banner--${readiness.tone}`}
      role={readiness.tone === "blocked" ? "alert" : "status"}
    >
      <span>{readiness.message}</span>
      {action?.kind === "swap" && (
        <button type="button" className="ws-compose__fix" onClick={onSwap}>
          Swap branches
        </button>
      )}
      {action?.kind === "open-existing" && (
        <button
          type="button"
          className="ws-compose__fix"
          onClick={() => onViewExisting(action.number)}
        >
          Go to #{action.number}
        </button>
      )}
    </div>
  );
}

function ComparisonSummary({
  compare,
}: Readonly<{ compare: BranchComparisonResponse }>) {
  const { comparison } = compare;
  const additions = comparison.files.reduce((sum, f) => sum + f.additions, 0);
  const deletions = comparison.files.reduce((sum, f) => sum + f.deletions, 0);

  return (
    <aside className="ws-compose__summary" aria-labelledby="ws-compose-summary">
      <h4 id="ws-compose-summary" className="ws-compose__subtitle">
        This pull request
      </h4>
      <p className="ws-hint">
        {plural(comparison.totalCommits, "commit")} ·{" "}
        {plural(comparison.files.length, "file")} changed ·{" "}
        <span className="ws-add">+{additions}</span>{" "}
        <span className="ws-del">−{deletions}</span>
      </p>
      {comparison.commits.length > 0 && (
        <ul className="ws-compose__commits">
          {comparison.commits.map((commit) => (
            <li key={commit.sha}>
              <code>{commit.sha.slice(0, 7)}</code> {commit.headline}
              {commit.author ? (
                <span className="ws-hint"> · {commit.author}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function ComposeForm({ vm }: Readonly<{ vm: CreatePullRequestViewModel }>) {
  const submitting = vm.status === "submitting";

  return (
    <form
      className="ws-compose__form"
      onSubmit={(event) => {
        event.preventDefault();
        void vm.submit();
      }}
    >
      <label className="ws-compose__field">
        <span className="ws-branch__label">Title</span>
        <input
          className="ws-input"
          value={vm.title}
          maxLength={256}
          required
          disabled={submitting}
          onChange={(event) => vm.setTitle(event.target.value)}
        />
      </label>

      <label className="ws-compose__field">
        <span className="ws-branch__label">Description</span>
        <textarea
          className="ws-input ws-input--area"
          value={vm.body}
          rows={6}
          disabled={submitting}
          placeholder="What does this change, and why?"
          onChange={(event) => vm.setBody(event.target.value)}
        />
      </label>

      <div className="ws-compose__actions">
        <label className="ws-compose__draft">
          <input
            type="checkbox"
            checked={vm.draft}
            disabled={submitting}
            onChange={(event) => vm.setDraft(event.target.checked)}
          />
          Open as a draft
        </label>
        <button
          type="submit"
          className="primary-button"
          disabled={!vm.canSubmit}
        >
          {submitting ? "Opening…" : "Create pull request"}
        </button>
      </div>

      {vm.submitMessage && (
        <p
          className="ws-compose__banner ws-compose__banner--blocked"
          role="alert"
        >
          {vm.submitMessage}
        </p>
      )}
    </form>
  );
}

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? "" : "s"}`;
}
