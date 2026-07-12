"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AppNav } from "@/components/layout/app-nav";
import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLoader } from "@/components/layout/pipeline-loader";
import { ProjectEnvPanel } from "@/components/product/project-env-panel";
import { RunCard } from "@/components/product/runs/RunCard";
import { RunsSkeleton } from "@/components/product/runs/RunsSkeleton";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useCapabilities } from "@/hooks/use-capabilities";
import { logout } from "@/lib/api/client";
import type {
  DeploymentTarget,
  ProjectOverviewResponse,
  RunGroup,
} from "@/lib/api/contracts";
import { getProjectOverview } from "@/lib/api/projects";
import { getRuns } from "@/lib/api/runs";
import { ApiError } from "@/lib/api/request";
import {
  providerDisplayName,
  providerPublicUrl,
} from "@/lib/hosting/provider-urls";
import { relativeTime } from "@/lib/runs/utils";
import { isGuest } from "@/lib/auth/subscription";

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

/** How often the live workflow feed refreshes, in milliseconds. */
const RUNS_POLL_INTERVAL_MS = 15_000;

/** Recent runs shown inline before the feed hands off to the full /runs history. */
const RECENT_RUNS_DISPLAY_LIMIT = 3;

function statusVariant(status: string): string {
  if (status === "provisioned") return "provisioned";
  if (status === "provisioning" || status === "pending") return "provisioning";
  return "failed";
}

function targetStatusColor(status: DeploymentTarget["status"]): string {
  if (status === "active") return "var(--accent-teal)";
  if (status === "missing") return "var(--accent-amber)";
  return "var(--danger)";
}

function HostingServiceCard({
  target,
  reduced,
}: Readonly<{ target: DeploymentTarget; reduced: boolean }>) {
  const publicUrl = providerPublicUrl(target);
  const provider = providerDisplayName(target.provider);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyPublicUrl = useCallback(async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
    } catch {
      // Clipboard access denied (e.g. insecure context); the visible link
      // remains selectable as the manual fallback.
    }
  }, [publicUrl]);

  return (
    <motion.article
      className="glass-panel"
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE_OUT }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem",
        padding: "1.1rem 1.25rem",
      }}
      aria-label={`${provider} hosting service`}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          flexWrap: "wrap",
        }}
      >
        <span
          className="workflow-page-studio-badge"
          style={{ textTransform: "none" }}
        >
          {provider}
        </span>
        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
          {target.slot === "frontend" ? "Frontend" : "Backend service"}
        </span>
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: "0.76rem",
            color: "var(--text-secondary)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: "0.5rem",
              height: "0.5rem",
              borderRadius: "50%",
              background: targetStatusColor(target.status),
            }}
          />
          {target.status}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
        <strong style={{ fontSize: "0.95rem" }}>
          {target.providerProjectName}
        </strong>
        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
          Branch {target.branchName || "test"}
          {target.rootDirectory && target.rootDirectory !== "."
            ? ` · ${target.rootDirectory}`
            : ""}
        </span>
      </div>

      {publicUrl ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            minWidth: 0,
          }}
        >
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            title={publicUrl}
            style={{
              fontSize: "0.8rem",
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--brand)",
              textDecoration: "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {publicUrl.replace(/^https?:\/\//, "")}
          </a>
          <button
            type="button"
            className="ghost-button"
            onClick={() => void copyPublicUrl()}
            aria-label={`Copy ${provider} service URL`}
            style={{
              minHeight: "1.7rem",
              padding: "0.15rem 0.6rem",
              fontSize: "0.72rem",
              flexShrink: 0,
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}

    </motion.article>
  );
}

function ProjectPageContent() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId ?? "";
  const prefersReducedMotion = useReducedMotion();
  const { status, session, error: sessionError, refresh } = useAuthSession();
  const { envProvisioningEnabled } = useCapabilities();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  const [overview, setOverview] = useState<ProjectOverviewResponse | null>(
    null,
  );
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  const [runs, setRuns] = useState<RunGroup[]>([]);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const guest = isGuest(session);
  const project = overview?.project ?? null;
  const targets = overview?.deploymentTargets.items ?? [];
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
    if (status !== "signed-in" || guest || !repoFullName) return;

    let active = true;
    const load = async () => {
      try {
        const response = await getRuns(repoFullName);
        if (!active) return;
        setRuns(response.runs);
        setRunsError(null);
        setLastRefreshedAt(new Date().toISOString());
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 404) {
          // Repo has no CI reports yet — that is an empty feed, not a failure.
          setRuns([]);
          setRunsError(null);
        } else {
          setRunsError("Could not refresh workflow runs.");
        }
      } finally {
        if (active) setLoadingRuns(false);
      }
    };

    void load();
    const timer = setInterval(() => void load(), RUNS_POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [guest, repoFullName, status]);

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
            {envProvisioningEnabled &&
            project &&
            project.status === "provisioned" ? (
              <section aria-label="Hosting services">
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "0.75rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  <h2 style={{ margin: 0, fontSize: "1.05rem" }}>
                    Hosting services
                  </h2>
                  {targets.length > 0 ? (
                    <span
                      style={{
                        fontSize: "0.78rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      {targets.length}{" "}
                      {targets.length === 1 ? "service" : "services"} attached
                    </span>
                  ) : null}
                </div>
                {targets.length > 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gap: "1rem",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(min(20rem, 100%), 1fr))",
                      marginBottom: "1rem",
                    }}
                  >
                    {targets.map((target) => (
                      <HostingServiceCard
                        key={target.id}
                        reduced={reduced}
                        target={target}
                      />
                    ))}
                  </div>
                ) : null}
                {targets.length === 0 ? (
                  <ProjectEnvPanel
                    onTargetCreated={() => void loadOverview()}
                    project={project}
                    section="hosting"
                  />
                ) : null}
              </section>
            ) : null}

            <section aria-label="Live workflow activity" aria-live="polite">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    marginBottom: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  <h2 style={{ margin: 0, fontSize: "1.05rem" }}>
                    Workflow activity
                  </h2>
                  <div className="workflow-page-studio-badge">
                    <span className="workflow-studio-led" aria-hidden="true" />
                    Live · refreshes every {RUNS_POLL_INTERVAL_MS / 1000}s
                  </div>
                  {lastRefreshedAt ? (
                    <span
                      style={{
                        fontSize: "0.76rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      Updated {relativeTime(lastRefreshedAt)}
                    </span>
                  ) : null}
                </div>

                {runsError ? (
                  <p className="error-text" style={{ marginBottom: "0.75rem" }}>
                    {runsError}
                  </p>
                ) : null}

                {loadingRuns ? (
                  <RunsSkeleton />
                ) : runs.length === 0 ? (
                  <div className="glass-panel" style={{ padding: "1.5rem" }}>
                    <p
                      style={{
                        margin: 0,
                        color: "var(--text-secondary)",
                        fontSize: "0.88rem",
                      }}
                    >
                      No pipeline runs yet for this project. Push a commit to{" "}
                      {project?.repoFullName ?? "the repository"} and the run
                      will appear here as it progresses.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="runs-list-stack">
                      {runs
                        .slice(0, RECENT_RUNS_DISPLAY_LIMIT)
                        .map((run, index) => (
                          <RunCard
                            key={run.runId}
                            index={index}
                            reduced={reduced}
                            run={run}
                          />
                        ))}
                    </div>
                    {runs.length > RECENT_RUNS_DISPLAY_LIMIT ? (
                      <Link
                        href={`/runs?repoFullName=${encodeURIComponent(
                          repoFullName ?? "",
                        )}`}
                        className="ghost-button"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          marginTop: "1rem",
                          fontSize: "0.82rem",
                        }}
                      >
                        View all {runs.length} workflow runs
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </Link>
                    ) : null}
                  </>
                )}
              </section>
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
