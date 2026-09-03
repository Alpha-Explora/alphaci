"use client";

import type { ProjectDetailViewModel } from "../view-models/use-project-detail-view-model";

/**
 * Disconnect / delete, rendered at the foot of the Settings tab.
 *
 * It lives here rather than inside ProjectDetailTabs because deleting navigates
 * away, and the route is what owns navigation. The two-step confirmation and
 * the typed repo name are the whole point: the destructive branch has to be
 * deliberate, not a checkbox away.
 */
export function ProjectDangerZone({
  vm,
  repoFullName,
  onDelete,
}: Readonly<{
  vm: ProjectDetailViewModel;
  repoFullName: string | undefined;
  onDelete: () => void;
}>) {
  const confirmDelete = vm.confirmDelete;
  const setConfirmDelete = vm.setConfirmDelete;
  const deleteGithubRepoOptIn = vm.deleteGithubRepoOptIn;
  const setDeleteGithubRepoOptIn = vm.setDeleteGithubRepoOptIn;
  const confirmRepoNameInput = vm.confirmRepoNameInput;
  const setConfirmRepoNameInput = vm.setConfirmRepoNameInput;
  const deleteError = vm.deleteError;
  const setDeleteError = vm.setDeleteError;
  const isDeleting = vm.isDeleting;
  const repoName = repoFullName ?? "";

  return (
    <section aria-label="Danger Zone" style={{ marginTop: "1rem" }}>
      <div
        className="glass-panel"
        style={{
          border: "1px solid rgba(248, 113, 113, 0.2)",
          background: "rgba(248, 113, 113, 0.02)",
          padding: "1.25rem 1.5rem",
          borderRadius: "var(--radius-card, 12px)",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {confirmDelete ? (
          <DeleteProjectConfirm
            repoName={repoName}
            deleteGithubRepoOptIn={deleteGithubRepoOptIn}
            confirmRepoNameInput={confirmRepoNameInput}
            deleteError={deleteError}
            isDeleting={isDeleting}
            onToggleGithub={(checked) => {
              setDeleteGithubRepoOptIn(checked);
              setConfirmRepoNameInput("");
            }}
            onConfirmName={setConfirmRepoNameInput}
            onDelete={onDelete}
            onCancel={() => {
              setConfirmDelete(false);
              setDeleteGithubRepoOptIn(false);
              setConfirmRepoNameInput("");
              setDeleteError(null);
            }}
          />
        ) : (
          <DeleteProjectIdle onStart={() => setConfirmDelete(true)} />
        )}
      </div>
    </section>
  );
}

function DeleteProjectIdle({ onStart }: Readonly<{ onStart: () => void }>) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1rem",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", color: "var(--danger, #f87171)", fontWeight: 600 }}>
          Delete Project
        </h3>
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
          Disconnect this project from ALPHACI. You can optionally delete the GitHub repository.
        </p>
      </div>
      <button
        type="button"
        className="confirm-btn-danger"
        onClick={onStart}
        style={{ padding: "0.45rem 1rem", fontSize: "0.82rem", minHeight: "2.2rem" }}
      >
        Delete Project
      </button>
    </div>
  );
}

function deleteConfirmDisabled(
  isDeleting: boolean,
  deleteGithubRepoOptIn: boolean,
  confirmRepoNameInput: string,
  repoName: string,
): boolean {
  if (isDeleting) return true;
  if (!deleteGithubRepoOptIn) return false;
  return confirmRepoNameInput !== repoName;
}

function deleteConfirmLabel(isDeleting: boolean, deleteGithubRepoOptIn: boolean): string {
  if (isDeleting) return "Deleting...";
  if (deleteGithubRepoOptIn) return "Delete repo & disconnect";
  return "Yes, disconnect";
}

function DeleteProjectConfirm({
  repoName,
  deleteGithubRepoOptIn,
  confirmRepoNameInput,
  deleteError,
  isDeleting,
  onToggleGithub,
  onConfirmName,
  onDelete,
  onCancel,
}: Readonly<{
  repoName: string;
  deleteGithubRepoOptIn: boolean;
  confirmRepoNameInput: string;
  deleteError: string | null;
  isDeleting: boolean;
  onToggleGithub: (checked: boolean) => void;
  onConfirmName: (value: string) => void;
  onDelete: () => void;
  onCancel: () => void;
}>) {
  return (
    <div
      role="group"
      aria-labelledby="delete-confirm-heading"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        <p
          id="delete-confirm-heading"
          style={{
            margin: 0,
            fontSize: "0.88rem",
            fontWeight: 700,
            color: "var(--danger, #f87171)",
          }}
        >
          Are you sure you want to delete this project?
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "0.78rem",
            color: "var(--text-muted)",
          }}
        >
          The project will be disconnected from ALPHACI. The GitHub repository will be kept unless you opt in below.
        </p>
      </div>

      <label
        className="enhancement-option"
        style={{ cursor: "pointer", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}
      >
        <input
          type="checkbox"
          checked={deleteGithubRepoOptIn}
          onChange={(e) => onToggleGithub(e.target.checked)}
          style={{ marginTop: "0.2rem" }}
        />
        <span style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
          <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "var(--text-primary)" }}>
            Also delete the GitHub repository
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Permanently deletes {repoName} on GitHub — this cannot be undone.
          </span>
        </span>
      </label>

      {deleteGithubRepoOptIn ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <label
            htmlFor="confirm-repo-name-input"
            style={{
              fontSize: "0.78rem",
              color: "var(--text-secondary)",
            }}
          >
            Type <strong style={{ color: "var(--text-primary)", fontFamily: "monospace" }}>{repoName}</strong> to confirm:
          </label>
          <input
            id="confirm-repo-name-input"
            type="text"
            value={confirmRepoNameInput}
            onChange={(e) => onConfirmName(e.target.value)}
            placeholder={repoName}
            autoComplete="off"
            style={{
              background: "rgba(17, 17, 22, 0.6)",
              border: "1px solid rgba(248, 113, 113, 0.3)",
              borderRadius: "0.5rem",
              padding: "0.5rem 0.75rem",
              fontSize: "0.85rem",
              color: "var(--text-primary)",
              fontFamily: "monospace",
              outline: "none",
              width: "100%",
              maxWidth: "26rem",
              boxSizing: "border-box",
            }}
          />
        </div>
      ) : null}

      {deleteError ? (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--danger, #f87171)" }}>
          {deleteError}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={() => void onDelete()}
          disabled={deleteConfirmDisabled(
            isDeleting,
            deleteGithubRepoOptIn,
            confirmRepoNameInput,
            repoName,
          )}
          className="confirm-btn-danger"
          style={{ padding: "0.45rem 1rem", fontSize: "0.82rem" }}
        >
          {deleteConfirmLabel(isDeleting, deleteGithubRepoOptIn)}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="confirm-btn-neutral"
          style={{ padding: "0.45rem 1rem", fontSize: "0.82rem" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

