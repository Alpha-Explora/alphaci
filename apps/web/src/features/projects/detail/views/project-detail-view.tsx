"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { AppNav } from "@/features/workspace/selection";
import { FlowBackground } from "@/shared/layout/flow-background";
import { PipelineLoader } from "@/shared/layout/pipeline-loader";
import type { AppRole } from "@/shared/api/contracts";
import { ProjectDetailTabs } from "./project-detail-tabs";
import { RunsSkeleton } from "@/features/runs/list";
import { useAuthSession } from "@/features/auth/session";
import { isGuest } from "@/features/auth/session";

import {
  isExternalRepo,
  isSignedInMember,
  overviewProject,
  projectRepoFullName,
  routeProjectId,
} from "../../model/projects-rules";
import { canManageProjectLifecycle } from "../model/project-detail-tab-rules";
import { useProjectDetailViewModel } from "../view-models/use-project-detail-view-model";
import { ProjectDangerZone } from "./project-danger-zone";

function ProjectSessionError({
  sessionError,
  projectId,
  onRetry,
}: Readonly<{
  sessionError: string | null;
  projectId: string;
  onRetry: () => void;
}>) {
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
              onClick={onRetry}
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

function ProjectGuestPrompt({ projectId }: Readonly<{ projectId: string }>) {
  return (
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
  );
}

function ProjectOverviewError({
  overviewError,
  onRetry,
}: Readonly<{
  overviewError: string;
  onRetry: () => void;
}>) {
  return (
    <div className="runs-error-state" role="alert">
      <div className="runs-error-body">
        <p>{overviewError}</p>
      </div>
      <div style={{ display: "flex", gap: "0.6rem" }}>
        <button
          type="button"
          className="ghost-button"
          onClick={onRetry}
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
  );
}

function ProjectDetailBody({
  guest,
  projectId,
  loadingOverview,
  overviewError,
  logoutMessage,
  project,
  enforcedOrg,
  dangerZone,
  appRole,
  onRetry,
}: Readonly<{
  guest: boolean;
  projectId: string;
  loadingOverview: boolean;
  overviewError: string | null;
  logoutMessage: string | null;
  project: NonNullable<
    ReturnType<typeof useProjectDetailViewModel>["overview"]
  >["project"] | null;
  enforcedOrg: string | undefined;
  dangerZone: ReactNode;
  appRole: AppRole | undefined;
  onRetry: () => void;
}>) {
  const logoutNotice = logoutMessage ? (
    <p className="error-text" style={{ marginTop: 0 }}>
      {logoutMessage}
    </p>
  ) : null;
  if (guest) {
    return (
      <>
        {logoutNotice}
        <ProjectGuestPrompt projectId={projectId} />
      </>
    );
  }
  if (loadingOverview) {
    return (
      <>
        {logoutNotice}
        <RunsSkeleton />
      </>
    );
  }
  if (overviewError) {
    return (
      <>
        {logoutNotice}
        <ProjectOverviewError overviewError={overviewError} onRetry={onRetry} />
      </>
    );
  }
  return (
    <>
      {logoutNotice}
      <div style={{ display: "grid", gap: "1.5rem" }}>
        {project ? (
          <ProjectDetailTabs
            project={project}
            external={isExternalRepo(project.repoFullName, enforcedOrg)}
            dangerZone={dangerZone}
            appRole={appRole}
          />
        ) : null}
      </div>
    </>
  );
}

/** Public view for one project's detail route. */
export function ProjectDetailView() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = routeProjectId(params);
  const {
    status,
    session,
    error: sessionError,
    refresh,
    signOut,
    isSigningOut: isLoggingOut,
  } = useAuthSession();
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  const guest = isGuest(session);
  const vm = useProjectDetailViewModel({
    projectId,
    enabled: isSignedInMember(status, guest),
  });

  const overviewError = vm.error;
  const loadingOverview = vm.status === "loading";
  const enforcedOrg = vm.enforcedOrg;
  const loadOverview = vm.reload;
  const project = overviewProject(vm.overview);
  const repoFullName = projectRepoFullName(project);

  useEffect(() => {
    if (status === "signed-out") {
      router.push(`/login?next=/projects/${encodeURIComponent(projectId)}`);
    }
  }, [projectId, router, status]);

  async function handleLogout() {
    setLogoutMessage(null);
    try {
      await signOut();
      router.push("/");
    } catch {
      setLogoutMessage("Sign out failed. Please retry, or use the Home link.");
    }
  }

  async function handleDeleteProject() {
    if (await vm.disconnect()) router.push("/home");
  }

  if (status === "loading") {
    return <PipelineLoader label="Loading project" />;
  }
  if (status === "error") {
    return (
      <ProjectSessionError
        sessionError={sessionError}
        projectId={projectId}
        onRetry={() => void refresh()}
      />
    );
  }
  if (status === "signed-out") return null;

  // Danger Zone (disconnect/delete) is admin/lead only — the backend's
  // `PROJECT_ROLE_FORBIDDEN` allow-list. Built only for a viewer who can use
  // it: `SettingsDangerZone` renders nothing when this is undefined, so the
  // control simply does not exist for anyone else, rather than existing and
  // failing.
  const dangerZone = canManageProjectLifecycle(session?.appRole) ? (
    <ProjectDangerZone
      vm={vm}
      repoFullName={repoFullName ?? undefined}
      onDelete={() => void handleDeleteProject()}
    />
  ) : undefined;

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
        <div className="project-page-body">
          <ProjectDetailBody
            guest={guest}
            projectId={projectId}
            loadingOverview={loadingOverview}
            overviewError={overviewError}
            logoutMessage={logoutMessage}
            project={project}
            enforcedOrg={enforcedOrg}
            dangerZone={dangerZone}
            appRole={session?.appRole}
            onRetry={() => void loadOverview()}
          />
        </div>
      </div>
    </main>
  );
}
