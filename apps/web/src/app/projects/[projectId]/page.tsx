"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AppNav } from "@/components/layout/app-nav";
import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLoader } from "@/components/layout/pipeline-loader";
import { ProjectEnvPanel } from "@/components/product/project-env-panel";
import { RunCard } from "@/components/product/runs/RunCard";
import { RunsSkeleton } from "@/components/product/runs/RunsSkeleton";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useCapabilities } from "@/hooks/use-capabilities";
import { logout, disconnectProject } from "@/lib/api/client";
import type {
  DeploymentTarget,
  ProjectOverviewResponse,
  RunGroup,
} from "@/lib/api/contracts";
import { getProjectOverview, getDeploymentTargetLogs } from "@/lib/api/projects";
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
  isLogsOpen,
  onToggleLogs,
}: Readonly<{
  target: DeploymentTarget;
  reduced: boolean;
  isLogsOpen: boolean;
  onToggleLogs: () => void;
}>) {
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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          minWidth: 0,
          marginTop: "0.3rem",
        }}
      >
        {publicUrl ? (
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
              flexGrow: 1,
            }}
          >
            {publicUrl.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", flexGrow: 1 }}>
            No public URL
          </span>
        )}

        {publicUrl ? (
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
        ) : null}

        <button
          type="button"
          className={isLogsOpen ? "ghost-button active" : "ghost-button"}
          onClick={onToggleLogs}
          aria-label={`View ${provider} service logs`}
          style={{
            minHeight: "1.7rem",
            padding: "0.15rem 0.6rem",
            fontSize: "0.72rem",
            flexShrink: 0,
            ...(isLogsOpen ? {
              background: "rgba(255, 255, 255, 0.08)",
              borderColor: "rgba(255, 255, 255, 0.2)",
              color: "var(--text-primary)",
            } : {}),
          }}
        >
          {isLogsOpen ? "Hide Logs" : "Logs"}
        </button>
      </div>
    </motion.article>
  );
}

interface LogLine {
  timestamp: string;
  message: string;
  level: string;
}

function ServiceLogsConsole({
  projectId,
  target,
  latestRun,
}: Readonly<{
  projectId: string;
  target: DeploymentTarget;
  latestRun?: RunGroup;
}>) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const loadLogs = useCallback(async () => {
    try {
      const res = await getDeploymentTargetLogs(projectId, target.id);
      setLogs(res.logs);
      setError(null);
    } catch {
      setError("Failed to fetch service logs.");
    } finally {
      setLoading(false);
    }
  }, [projectId, target.id]);

  useEffect(() => {
    void loadLogs();
    const interval = setInterval(() => {
      void loadLogs();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadLogs]);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const filteredLogs = logs.filter((log) =>
    log.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatHeaderDate = () => {
    return new Date().toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getCommitText = () => {
    if (latestRun) {
      const sha = latestRun.commitSha?.slice(0, 7) || "";
      const msg = latestRun.commitMessage || "";
      return `${sha} ${msg}`;
    }
    return "Initial deployment";
  };

  return (
    <div
      className="glass-panel"
      style={{
        marginTop: "1.2rem",
        padding: "1.25rem 1.5rem",
        borderRadius: "var(--radius-card, 12px)",
        background: "rgba(10, 10, 12, 0.4)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          paddingBottom: "0.5rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              {formatHeaderDate()}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                background: "rgba(16, 185, 129, 0.1)",
                color: "#34d399",
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "0.1rem 0.45rem",
                borderRadius: "1rem",
                border: "1px solid rgba(16, 185, 129, 0.2)",
              }}
            >
              <span
                style={{
                  width: "0.35rem",
                  height: "0.35rem",
                  borderRadius: "50%",
                  background: "#10b981",
                  display: "inline-block",
                  boxShadow: "0 0 8px #10b981",
                }}
              />
              Live
            </span>
          </div>
          <span
            style={{
              fontSize: "0.78rem",
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--text-muted)",
              textDecoration: "underline",
              cursor: "default",
            }}
          >
            {getCommitText()}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <select
            style={{
              background: "rgba(17, 17, 22, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "0.35rem",
              padding: "0.35rem 0.6rem",
              fontSize: "0.78rem",
              color: "var(--text-secondary)",
              outline: "none",
            }}
          >
            <option>All logs</option>
          </select>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs"
            style={{
              background: "rgba(17, 17, 22, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "0.35rem",
              padding: "0.35rem 0.6rem",
              fontSize: "0.78rem",
              color: "var(--text-primary)",
              outline: "none",
              minWidth: "10rem",
            }}
          />

          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              background: "rgba(255,255,255,0.04)",
              padding: "0.35rem 0.5rem",
              borderRadius: "0.35rem",
            }}
          >
            GMT+8
          </span>
        </div>
      </div>

      <div
        style={{
          background: "rgba(10, 10, 12, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          borderRadius: "8px",
          padding: "1rem",
          fontFamily: "var(--font-mono, Courier, monospace)",
          fontSize: "0.8rem",
          color: "rgba(255, 255, 255, 0.9)",
          lineHeight: "1.45",
          height: "22rem",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.3rem",
        }}
      >
        {loading ? (
          <span style={{ color: "var(--text-muted)" }}>Loading log stream...</span>
        ) : error ? (
          <span style={{ color: "var(--danger)" }}>{error}</span>
        ) : filteredLogs.length === 0 ? (
          <span style={{ color: "var(--text-muted)" }}>
            {searchQuery ? "No logs match search query" : "Console is empty"}
          </span>
        ) : (
          filteredLogs.map((log, idx) => {
            let rowColor = "inherit";
            let bgStyle = {};
            if (log.level === "warn") {
              rowColor = "#fbbf24";
              bgStyle = { background: "rgba(245, 158, 11, 0.05)", margin: "0 -0.5rem", padding: "0 0.5rem" };
            } else if (log.level === "error") {
              rowColor = "#f87171";
              bgStyle = { background: "rgba(239, 68, 68, 0.06)", margin: "0 -0.5rem", padding: "0 0.5rem" };
            } else if (log.level === "system") {
              rowColor = "#34d399";
            }

            let displayTime = "";
            try {
              const d = new Date(log.timestamp);
              displayTime = d.toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });
            } catch {
              displayTime = log.timestamp;
            }

            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  alignItems: "flex-start",
                  wordBreak: "break-all",
                  whiteSpace: "pre-wrap",
                  ...bgStyle,
                }}
              >
                <span style={{ color: "var(--text-muted)", flexShrink: 0, userSelect: "none" }}>
                  {displayTime}
                </span>
                <span style={{ color: rowColor }}>{log.message}</span>
              </div>
            );
          })
        )}
        <div ref={consoleEndRef} />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          paddingTop: "0.25rem",
          fontSize: "0.78rem",
          color: "var(--text-muted)",
        }}
      >
        <span>
          Need better ways to work with logs? Try the{" "}
          <strong style={{ color: "var(--text-secondary)" }}>
            {target.provider === "render" ? "Render CLI, Render MCP Server" : "Vercel CLI, Vercel MCP Server"}
          </strong>
          , or set up a{" "}
          <span style={{ textDecoration: "underline", cursor: "pointer" }}>
            log stream integration
          </span>
        </span>
      </div>
    </div>
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

  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteGithubRepoOptIn, setDeleteGithubRepoOptIn] = useState(false);
  const [confirmRepoNameInput, setConfirmRepoNameInput] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [runs, setRuns] = useState<RunGroup[]>([]);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [activeLogTargetId, setActiveLogTargetId] = useState<string | null>(null);

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
                  <>
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
                          isLogsOpen={activeLogTargetId === target.id}
                          onToggleLogs={() =>
                            setActiveLogTargetId((prev) =>
                              prev === target.id ? null : target.id,
                            )
                          }
                        />
                      ))}
                    </div>

                    {(() => {
                      const activeTarget = targets.find(
                        (t) => t.id === activeLogTargetId,
                      );
                      if (activeTarget && project) {
                        return (
                          <ServiceLogsConsole
                            projectId={project.id}
                            target={activeTarget}
                            latestRun={runs[0]}
                          />
                        );
                      }
                      return null;
                    })()}
                  </>
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
