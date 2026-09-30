"use client";

import type { AppRole } from "@/shared/api/contracts";
import { selectableBaseBranches } from "../../model/pull-request-compose-rules";
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
  onCancel,
  onCreated,
  onViewExisting,
}: Readonly<{
  projectId: string;
  /** The viewer's app role. QA does not open pull requests. */
  appRole?: AppRole;
  onCancel: () => void;
  onCreated: (pullRequest: PullRequestSummary) => void;
  /** Leave compose for a pull request that is already open for this pair. */
  onViewExisting: (pullNumber: number) => void;
}>) {
  // Called unconditionally regardless of role — QA reaches this component
  // only through a stale UI state or a direct link, and skipping the hook
  // for that case would break the rules of hooks for one defensive path.
  const vm = useCreatePullRequestViewModel({ projectId, appRole, onCreated });

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
          <BranchPickers vm={vm} />
          <ComposeBody vm={vm} onViewExisting={onViewExisting} />
        </>
      )}
    </section>
  );
}

function BranchPickers({ vm }: Readonly<{ vm: CreatePullRequestViewModel }>) {
  const busy = vm.status === "submitting";
  // `main` is never a selectable base: Hop 3 is locked to the promotion
  // engine and QA Studio, not this composer, for every role.
  const baseOptions = selectableBaseBranches(vm.branches);

  return (
    <div className="ws-compose__branches">
      <label className="ws-compose__branch">
        <span className="ws-branch__label">Merge into</span>
        <select
          className="ws-select"
          value={vm.base}
          disabled={busy}
          onChange={(event) => vm.setBase(event.target.value)}
        >
          {baseOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="ws-compose__swap"
        onClick={vm.swapBranches}
        disabled={busy || !vm.head}
        aria-label="Swap the two branches"
        title="Swap the two branches"
      >
        ⇄
      </button>

      <label className="ws-compose__branch">
        <span className="ws-branch__label">From</span>
        <select
          className="ws-select"
          value={vm.head}
          disabled={busy}
          onChange={(event) => vm.setHead(event.target.value)}
        >
          <option value="" disabled>
            Choose a branch…
          </option>
          {vm.branches
            .filter((name) => name !== vm.base)
            .map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
        </select>
      </label>
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

  return (
    <>
      <ReadinessBanner
        readiness={vm.readiness}
        onSwap={vm.swapBranches}
        onViewExisting={onViewExisting}
      />
      <ComparisonSummary compare={vm.compare} />
      {vm.readiness.canCreate && <ComposeForm vm={vm} />}
      <DiffView
        files={vm.compare.comparison.files}
        truncated={vm.compare.comparison.filesTruncated}
      />
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
    <div className="ws-compose__summary">
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
    </div>
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
