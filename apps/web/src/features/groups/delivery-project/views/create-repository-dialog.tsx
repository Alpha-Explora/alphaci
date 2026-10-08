"use client";

import Link from "next/link";

import type { HierarchyRepository } from "@/features/groups";
import { Dialog, FormDialog } from "@/features/groups/workspace";
import "./create-repository.css";
import {
  useCreateRepositoryViewModel,
  type CreateRepositoryViewModel,
} from "../view-models/use-create-repository-view-model";
import type { RepositoryOutcomeView } from "../../model/add-repository-rules";

interface CreateRepositoryDialogProps {
  open: boolean;
  deliveryProjectId: string;
  onClose: () => void;
  onCreated: (repository: HierarchyRepository) => void;
}

/**
 * "Add repository" inside a Project: name, stack, and ALPHACI-managed hosting
 * (on by default). Mounted only while open, so every opening starts fresh and
 * the wizard catalog is read only when someone is about to use it.
 */
export function CreateRepositoryDialog(props: Readonly<CreateRepositoryDialogProps>) {
  if (!props.open) return null;
  return <CreateRepositoryDialogBody {...props} />;
}

function CreateRepositoryDialogBody({
  deliveryProjectId,
  onClose,
  onCreated,
}: Readonly<CreateRepositoryDialogProps>) {
  const vm = useCreateRepositoryViewModel(deliveryProjectId, onCreated);

  if (vm.outcome) {
    return (
      <Dialog open onClose={onClose} title={vm.outcome.title}>
        <RepositoryOutcome outcome={vm.outcome} onClose={onClose} />
      </Dialog>
    );
  }

  return (
    <FormDialog
      open
      onClose={onClose}
      title="Add repository"
      description="Creates a GitHub repository with its CI/CD pipeline in this Project, set up the same way as the create wizard."
      submitLabel="Add repository"
      submitting={vm.status === "submitting"}
      error={vm.error}
      canSubmit={vm.canSubmit}
      onSubmit={() => void vm.submit()}
    >
      <div className="create-repo">
        <NameField vm={vm} />
        <StackField vm={vm} />
        <ShapeField vm={vm} />
        <VisibilityField />
        <HostingField vm={vm} />
        <AdvancedFields vm={vm} />
      </div>
    </FormDialog>
  );
}

type FieldProps = Readonly<{ vm: CreateRepositoryViewModel }>;

function NameField({ vm }: FieldProps) {
  return (
    <div className="hier-field">
      <label className="hier-field-label" htmlFor="repo-name">
        Repository name
      </label>
      <input
        id="repo-name"
        className="hier-input"
        value={vm.name}
        onChange={(event) => vm.setName(event.target.value)}
        placeholder="e.g. checkout-service"
        maxLength={100}
        autoComplete="off"
      />
    </div>
  );
}

function stackPlaceholder(vm: CreateRepositoryViewModel): string {
  if (vm.stacksLoading) return "Loading stacks…";
  return vm.stacks.length > 0 ? "Choose a stack" : "No stacks available";
}

function StackField({ vm }: FieldProps) {
  return (
    <div className="hier-field">
      <label className="hier-field-label" htmlFor="repo-stack">
        Stack <span className="create-repo__required">(required)</span>
      </label>
      <select
        id="repo-stack"
        className="hier-select"
        value={vm.stackId}
        onChange={(event) => vm.setStackId(event.target.value)}
        disabled={vm.stacksLoading || vm.stacks.length === 0}
        aria-required="true"
      >
        <option value="">{stackPlaceholder(vm)}</option>
        {vm.stacks.map((stack) => (
          <option key={stack.id} value={stack.id}>
            {stack.label} ({stack.language})
          </option>
        ))}
      </select>
      {vm.stacksError ? (
        <span className="hier-field-hint create-repo__hint--danger">{vm.stacksError}</span>
      ) : (
        <span className="hier-field-hint">Sets the starter code, the pipeline and where it deploys.</span>
      )}
    </div>
  );
}

/** Shown only when the catalog offers more than one single-repository shape. */
function ShapeField({ vm }: FieldProps) {
  if (vm.shapes.length < 2) return null;
  return (
    <div className="hier-field">
      <label className="hier-field-label" htmlFor="repo-shape">
        Repository shape
      </label>
      <select
        id="repo-shape"
        className="hier-select"
        value={vm.shapeId}
        onChange={(event) => vm.setShapeId(event.target.value)}
      >
        {vm.shapes.map((shape) => (
          <option key={shape.id} value={shape.id}>
            {shape.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function VisibilityField() {
  return (
    <div className="hier-field">
      <span className="hier-field-label">Visibility</span>
      <span className="create-repo__private">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Private
      </span>
    </div>
  );
}

function managedHint(provider: string | null): string {
  const base = "Vercel for frontends, Render for backends, deployed from the uat branch.";
  return provider ? `${base} This stack deploys to ${provider}.` : base;
}

function HostingField({ vm }: FieldProps) {
  return (
    <fieldset className="create-repo__hosting">
      <legend className="hier-field-label">Hosting</legend>
      <label className="create-repo__choice">
        <input
          type="radio"
          name="repo-hosting"
          checked={vm.hostingEnabled}
          onChange={() => vm.setHostingEnabled(true)}
        />
        <span>
          <strong>ALPHACI-managed hosting</strong>
          <span className="hier-field-hint">{managedHint(vm.hostingProvider)}</span>
        </span>
      </label>
      <label className="create-repo__choice">
        <input
          type="radio"
          name="repo-hosting"
          checked={!vm.hostingEnabled}
          onChange={() => vm.setHostingEnabled(false)}
        />
        <span>
          <strong>No hosting</strong>
          <span className="hier-field-hint">Only the repository and its pipeline are created.</span>
        </span>
      </label>
    </fieldset>
  );
}

function AdvancedFields({ vm }: FieldProps) {
  return (
    <details className="create-repo__advanced">
      <summary>Advanced</summary>
      <div className="create-repo__advanced-body">
        <div className="hier-field">
          <label className="hier-field-label" htmlFor="repo-recipe">
            Workflow recipe
          </label>
          <select
            id="repo-recipe"
            className="hier-select"
            value={vm.recipeId}
            onChange={(event) => vm.setRecipeId(event.target.value)}
            disabled={vm.recipes.length === 0}
          >
            {vm.recipes.length === 0 ? <option value="">Choose a stack first</option> : null}
            {vm.recipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.label}
              </option>
            ))}
          </select>
        </div>
        <NodeVersionField vm={vm} />
        {vm.hostingEnabled ? <HostingOverrideFields vm={vm} /> : null}
      </div>
    </details>
  );
}

function NodeVersionField({ vm }: FieldProps) {
  if (vm.nodeVersions.length === 0) return null;
  return (
    <div className="hier-field">
      <label className="hier-field-label" htmlFor="repo-node">
        Node version
      </label>
      <select
        id="repo-node"
        className="hier-select"
        value={vm.nodeVersion}
        onChange={(event) => vm.setNodeVersion(event.target.value)}
      >
        {vm.nodeVersions.map((version) => (
          <option key={version.value} value={version.value}>
            {version.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function HostingOverrideFields({ vm }: FieldProps) {
  return (
    <>
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="repo-root-dir">
          Hosting root directory
        </label>
        <input
          id="repo-root-dir"
          className="hier-input"
          value={vm.overrides.rootDirectory}
          onChange={(event) => vm.setOverride("rootDirectory", event.target.value)}
          placeholder="."
          autoComplete="off"
        />
      </div>
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="repo-build-cmd">
          Hosting build command
        </label>
        <input
          id="repo-build-cmd"
          className="hier-input"
          value={vm.overrides.buildCommand}
          onChange={(event) => vm.setOverride("buildCommand", event.target.value)}
          placeholder="npm run build"
          autoComplete="off"
        />
        <span className="hier-field-hint">Leave both empty to use the managed defaults.</span>
      </div>
    </>
  );
}

/** The result step: created, and what happened to hosting. */
export function RepositoryOutcome({
  outcome,
  onClose,
}: Readonly<{ outcome: RepositoryOutcomeView; onClose: () => void }>) {
  return (
    <div className="create-repo">
      <div className={`create-repo__outcome create-repo__outcome--${outcome.tone}`} role="status">
        <p className="create-repo__outcome-message">{outcome.message}</p>
        {outcome.reasons.length > 0 ? (
          <ul className="create-repo__reasons">
            {outcome.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="hier-dialog-actions">
        {outcome.hostingHref ? (
          <Link className="ghost-button" href={outcome.hostingHref}>
            Open the Hosting tab
          </Link>
        ) : (
          <Link className="ghost-button" href={outcome.repositoryHref}>
            Open repository
          </Link>
        )}
        <button type="button" className="primary-button" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
