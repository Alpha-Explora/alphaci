"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AppNav } from "@/components/layout/app-nav";
import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLoader } from "@/components/layout/pipeline-loader";
import { ProjectDetailTabs } from "@/components/product/project-detail-tabs";
import { RunsSkeleton } from "@/features/runs/list";
import { useAuthSession } from "@/hooks/use-auth-session";
import { logout, disconnectProject, getProjectOptions } from "@/lib/api/client";
import type {
  ProjectOverviewResponse,
} from "@/lib/api/contracts";
import { getProjectOverview } from "@/lib/api/projects";
import { ApiError } from "@/lib/api/request";
import {
} from "@/lib/hosting/provider-urls";
import { isGuest } from "@/lib/auth/subscription";

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

/** How often the live workflow feed refreshes, in milliseconds. */

/** Recent runs shown inline before the feed hands off to the full /runs history. */

function statusVariant(status: string): string {
  if (status === "provisioned") return "provisioned";
  if (status === "provisioning" || status === "pending") return "provisioning";
  return "failed";
}

function isExternalRepo(repoFullName: string, enforcedOrg?: string): boolean {
  if (!enforcedOrg) return false;
  return repoFullName.split("/")[0]?.toLowerCase() !== enforcedOrg.toLowerCase();
}

function ProjectPageContent() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId ?? "";
  const prefersReducedMotion = useReducedMotion();
  const { status, session, error: sessionError, refresh } = useAuthSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  const [overview, setOverview] = useState<ProjectOverviewResponse | null>(
    null,
  );
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  // Login of the org every new repository must belong to — used only to
  // label already-attached repos outside it as "External" (product decision;
  // existing external attachments stay untouched).
  const [enforcedOrg, setEnforcedOrg] = useState<string | undefined>(
    undefined,
  );

  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteGithubRepoOptIn, setDeleteGithubRepoOptIn] = useState(false);
  const [confirmRepoNameInput, setConfirmRepoNameInput] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const guest = isGuest(session);
  const project = overview?.project ?? null;
  const repoFullName = project?.repoFullName ?? null;

  useEffect(() => {
    if (status === "signed-out") {
      router.push(`/login?next=/projects/${encodeURIComponent(projectId)}`);
    }
  }, [projectId, router, status]);

  const loadOverview = useCallback(async () => {
    if (!projectId) return;
    setLoadingOverview(true);
    try {
      const response = await getProjectOverview(projectId);
      setOverview(response);
      setOverviewError(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setOverviewError(
          "This project could not be found. It may have been disconnected.",
        );
      } else {
        setOverviewError("Could not load this project. Please retry.");
      }
    } finally {
      setLoadingOverview(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (status !== "signed-in" || guest) return;
    void loadOverview();
  }, [guest, loadOverview, status]);

  useEffect(() => {
    if (status !== "signed-in" || guest) return;
    let active = true;
    void getProjectOptions()
      .then((response) => {
        if (active) setEnforcedOrg(response.enforcedOrg);
      })
      .catch(() => {
        // Non-critical: the External badge just won't render.
      });
    return () => {
      active = false;
    };
  }, [guest, status]);

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutMessage(null);
    try {
      await logout();
      await refresh();
      router.push("/");
    } catch {
      setLogoutMessage("Sign out failed. Please retry, or use the Home link.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  const handleDeleteProject = useCallback(async () => {
    if (!project) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await disconnectProject(
        project.id,
        deleteGithubRepoOptIn
          ? {
              deleteGithubRepo: true,
              confirmRepoName: project.repoFullName,
            }
          : undefined,
      );
      router.push("/home");
    } catch {
      setDeleteError("Failed to delete project. Please verify permissions and try again.");
    } finally {
      setIsDeleting(false);
    }
  }, [project, deleteGithubRepoOptIn, router]);

  if (status === "loading") {
    return <PipelineLoader label="Loading project" />;
  }

  if (status === "error") {
    return (
      <main className="dash-shell">
        <FlowBackground />
        <div className="state-body">
          <div className="state-card">
            <h1>Session verification failed</h1>
            <p>
              We could not verify your session. Please retry or sign in again.
            </p>
            {sessionError ? (
              <p className="error-text" style={{ fontSize: "0.82rem" }}>
                {sessionError}
              </p>
            ) : null}
            <div className="hero-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => void refresh()}
              >
                Retry
              </button>
              <Link
                className="ghost-button"
                href={`/login?next=/projects/${encodeURIComponent(projectId)}`}
              >
                Go to login
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (status === "signed-out") return null;

  const reduced = prefersReducedMotion ?? false;
  const repoName = repoFullName?.split("/")[1] ?? repoFullName ?? "Project";

  /*
   * Handed to ProjectDetailTabs, which places it at the foot of Settings.
   * Built here because deleting navigates away: the router push, the
   * confirmation state and the "also delete the GitHub repo" choice all
   * belong to the page that owns the route.
   */
  const dangerZone = (
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
        {!confirmDelete ? (
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
              onClick={() => setConfirmDelete(true)}
              style={{ padding: "0.45rem 1rem", fontSize: "0.82rem", minHeight: "2.2rem" }}
            >
              Delete Project
            </button>
          </div>
        ) : (
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
                onChange={(e) => {
                  setDeleteGithubRepoOptIn(e.target.checked);
                  setConfirmRepoNameInput("");
                }}
                style={{ marginTop: "0.2rem" }}
              />
              <span style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  Also delete the GitHub repository
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Permanently deletes {project?.repoFullName} on GitHub — this cannot be undone.
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
                  Type <strong style={{ color: "var(--text-primary)", fontFamily: "monospace" }}>{project?.repoFullName}</strong> to confirm:
                </label>
                <input
                  id="confirm-repo-name-input"
                  type="text"
                  value={confirmRepoNameInput}
                  onChange={(e) => setConfirmRepoNameInput(e.target.value)}
                  placeholder={project?.repoFullName}
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
                onClick={() => void handleDeleteProject()}
                disabled={
                  isDeleting ||
                  (deleteGithubRepoOptIn &&
                    confirmRepoNameInput !== project?.repoFullName)
                }
                className="confirm-btn-danger"
                style={{ padding: "0.45rem 1rem", fontSize: "0.82rem" }}
              >
                {isDeleting
                  ? "Deleting..."
                  : deleteGithubRepoOptIn
                    ? "Delete repo & disconnect"
                    : "Yes, disconnect"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(false);
                  setDeleteGithubRepoOptIn(false);
                  setConfirmRepoNameInput("");
                  setDeleteError(null);
                }}
                className="confirm-btn-neutral"
                style={{ padding: "0.45rem 1rem", fontSize: "0.82rem" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );

  return (
    <main
      className="dash-shell"
      suppressHydrationWarning
      style={{ overflowX: "hidden" }}
    >
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <FlowBackground />
      <AppNav
        guest={guest}
        session={session}
        onLogout={() => void handleLogout()}
        isLoggingOut={isLoggingOut}
      />

      <div id="main-content" className="dash-page-content project-page-shell">
        <motion.div
          className="workflow-page-header workflow-page-header--compact project-page-header"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE_OUT }}
        >
          <div className="workflow-page-header-left">
            <p className="workflow-page-breadcrumb">
              <span style={{ opacity: 0.55 }}>ALPHACI</span>
              <span className="workflow-page-breadcrumb-sep">/</span>
              <Link href="/workflows" className="inline-link">
                Projects
              </Link>
              <span className="workflow-page-breadcrumb-sep">/</span>
              <span>{repoName}</span>
            </p>
            <div className="workflow-page-title-row">
              <h1 className="workflow-page-title">{repoName}</h1>
              <div className="workflow-page-studio-badge">
                <span className="workflow-studio-led" aria-hidden="true" />
                Project overview
              </div>
              {project ? (
                <span
                  className={`project-status-badge ${statusVariant(project.status)}`}
                >
                  {project.status}
                </span>
              ) : null}
              {project && isExternalRepo(project.repoFullName, enforcedOrg) ? (
                <span className="project-status-badge external">External</span>
              ) : null}
            </div>
            {project ? (
              <p
                style={{
                  margin: "0.4rem 0 0",
                  color: "var(--text-secondary)",
                  fontSize: "0.86rem",
                }}
              >
                {project.repoFullName} · {project.serviceName}
              </p>
            ) : null}
          </div>
          <div
            className="workflow-page-signal-strip"
            aria-label="Project workflow model"
          >
            <div>
              <span>Mode</span>
              <strong>PR-safe updates</strong>
            </div>
            <div>
              <span>Promotion</span>
              <strong>test &gt; uat &gt; main</strong>
            </div>
            <div>
              <span>Stages</span>
              <strong>Access, Quality, Package</strong>
            </div>
          </div>
        </motion.div>

        <div className="project-page-body">
        {logoutMessage ? (
          <p className="error-text" style={{ marginTop: 0 }}>
            {logoutMessage}
          </p>
        ) : null}

        {guest ? (
          <div
            className="glass-panel"
            style={{ textAlign: "center", padding: "3rem 1.5rem" }}
          >
            <p
              style={{
                color: "var(--text-secondary)",
                marginBottom: "1.25rem",
                fontSize: "0.9rem",
              }}
            >
              Sign in to see this project&apos;s hosting and workflow activity.
            </p>
            <Link
              className="primary-button"
              href={`/login?next=/projects/${encodeURIComponent(projectId)}`}
              style={{ padding: "0.65rem 1.5rem", fontSize: "0.9rem" }}
            >
              Sign in
            </Link>
          </div>
        ) : loadingOverview ? (
          <RunsSkeleton />
        ) : overviewError ? (
          <div className="runs-error-state" role="alert">
            <div className="runs-error-body">
              <p>{overviewError}</p>
            </div>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void loadOverview()}
                style={{
                  padding: "0.35rem 1rem",
                  fontSize: "0.82rem",
                  minHeight: "2rem",
                }}
              >
                Retry
              </button>
              <Link
                className="ghost-button"
                href="/workflows"
                style={{
                  padding: "0.35rem 1rem",
                  fontSize: "0.82rem",
                  minHeight: "2rem",
                }}
              >
                All projects
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1.5rem" }}>
            {/*
              EVERYTHING about a project is inside these tabs.

              Hosting services, workflow activity and the delete flow used to be
              rendered here, BELOW the tab set, so all three were on screen no
              matter which tab you were reading. Each now lives in the one tab it
              belongs to — Hosting, Pipeline runs and Settings — which is what
              makes the tabs mean anything.
            */}
            {project ? (
              <ProjectDetailTabs project={project} dangerZone={dangerZone} />
            ) : null}
          </div>
        )}
        </div>
      </div>
    </main>
  );
}

export default function ProjectPage() {
  return <ProjectPageContent />;
}
