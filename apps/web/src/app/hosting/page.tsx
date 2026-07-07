"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AppNav } from "@/components/layout/app-nav";
import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLoader } from "@/components/layout/pipeline-loader";
import {
  WorkspaceProvider,
  useWorkspaceSelection,
} from "@/components/layout/workspace-context";
import { DeploymentProvisioningSetup } from "@/components/product/deployment-provisioning-setup";
import { DeploymentProvidersSection } from "@/components/settings/deployment-providers-section";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useDeploymentProvisioningForm } from "@/hooks/use-deployment-provisioning-form";
import { logout } from "@/lib/api/client";
import type { WorkspacesMeResponse } from "@/lib/api/contracts";
import { getMyWorkspaces } from "@/lib/api/workspaces";
import { isGuest } from "@/lib/auth/subscription";

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

function HostingPageContent() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const { status, session, error, refresh } = useAuthSession();
  const { deploymentOwnershipMode, workspacesEnabled } = useCapabilities();
  const { selectedWorkspace, setWorkspaces: setWorkspaceContext } =
    useWorkspaceSelection();
  const hostingSetup = useDeploymentProvisioningForm();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);
  const [setupInitialized, setSetupInitialized] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspacesMeResponse | null>(
    null,
  );
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "signed-out") {
      router.push("/login?next=/hosting");
    }
  }, [router, status]);

  useEffect(() => {
    if (!workspacesEnabled || status !== "signed-in") return;
    let active = true;
    void getMyWorkspaces()
      .then((response) => {
        if (!active) return;
        setWorkspaces(response);
        setWorkspaceContext(response);
        setWorkspacesError(null);
      })
      .catch(() => {
        if (active) {
          setWorkspacesError("Workspaces are unavailable right now.");
        }
      });
    return () => {
      active = false;
    };
  }, [setWorkspaceContext, status, workspacesEnabled]);

  useEffect(() => {
    if (status !== "signed-in" || setupInitialized) return;
    hostingSetup.setDefaultTargets([
      { slot: "backend", projectName: "backend-service" },
      { slot: "frontend", projectName: "frontend-app" },
    ]);
    setSetupInitialized(true);
  }, [hostingSetup, setupInitialized, status]);

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
    return <PipelineLoader label="Loading hosting services" />;
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
            {error ? (
              <p className="error-text" style={{ fontSize: "0.82rem" }}>
                {error}
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
              <Link className="ghost-button" href="/login?next=/hosting">
                Go to login
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (status === "signed-out") return null;

  const guest = isGuest(session);
  const reduced = prefersReducedMotion ?? false;
  const selectedWorkspaceRole =
    selectedWorkspace?.role ?? workspaces?.items[0]?.role ?? null;

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

      <div id="main-content" className="dash-page-content">
        <motion.div
          className="workflow-page-header workflow-page-header--compact"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE_OUT }}
        >
          <div className="workflow-page-header-left">
            <p className="workflow-page-breadcrumb">
              <span style={{ opacity: 0.55 }}>Alphaexplora</span>
              <span className="workflow-page-breadcrumb-sep">/</span>
              <span>Hosting Services</span>
            </p>
            <div className="workflow-page-title-row">
              <h1 className="workflow-page-title">Hosting Services</h1>
              <div className="workflow-page-studio-badge">
                <span className="workflow-studio-led" aria-hidden="true" />
                Render and Vercel
              </div>
            </div>
            <p
              style={{
                margin: "0.4rem 0 0",
                color: "var(--text-secondary)",
                fontSize: "0.86rem",
                maxWidth: "48rem",
                lineHeight: 1.55,
              }}
            >
              Choose the Render backend and Vercel frontend setup, branches,
              variable groups, and branch-specific variables used when creating
              repositories.
            </p>
          </div>
        </motion.div>

        {logoutMessage ? (
          <p className="error-text" style={{ marginTop: 0 }}>
            {logoutMessage}
          </p>
        ) : null}
        {workspacesError ? (
          <p className="error-text" style={{ marginTop: 0 }}>
            {workspacesError}
          </p>
        ) : null}

        <div style={{ display: "grid", gap: "1.25rem" }}>
          <DeploymentProvisioningSetup
            enabled={hostingSetup.enabled}
            ownershipMode={deploymentOwnershipMode}
            repoShape="microservices"
            value={hostingSetup.request}
            onChange={hostingSetup.setRequest}
            onEnabledChange={(enabled) => {
              if (enabled) {
                hostingSetup.setDefaultTargets([
                  { slot: "backend", projectName: "backend-service" },
                  { slot: "frontend", projectName: "frontend-app" },
                ]);
              } else {
                hostingSetup.setEnabled(false);
              }
            }}
          />

          {deploymentOwnershipMode === "byo" ? (
            <DeploymentProvidersSection workspaceRole={selectedWorkspaceRole} />
          ) : (
            <section className="provider-settings-panel">
              <div className="provider-settings-header">
                <h2>Provider Accounts</h2>
                <p>
                  Hosting is managed through the organization Render and Vercel
                  accounts for this deployment.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

export default function HostingPage() {
  return (
    <WorkspaceProvider>
      <HostingPageContent />
    </WorkspaceProvider>
  );
}
