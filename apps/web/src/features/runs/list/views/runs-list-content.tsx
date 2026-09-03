"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

import { AppNav } from "@/features/workspace/selection";
import { FlowBackground } from "@/shared/layout/flow-background";
import type { useAuthSession } from "@/features/auth/session";

import { useRunsListViewModel } from "../view-models/use-runs-list-view-model";
import { ProjectGroupSection } from "./project-group-section";
import { RunsEmptyState } from "./runs-empty-state";
import { RunsErrorState } from "./runs-error-state";
import { RunsSkeleton } from "./runs-skeleton";
import { RunsSummaryStrip } from "./runs-summary-strip";

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

const sectionVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: EASE_OUT, delay: delay * 0.06 },
  }),
};
type RunsListViewModel = ReturnType<typeof useRunsListViewModel>;

/**
 * The runs list itself.
 *
 * Reads ?repoFullName through its view-model, so this component must stay
 * inside the Suspense boundary that RunsListView provides. Hoisting it above
 * that boundary opts the whole route into dynamic rendering.
 */
export function RunsListContent({
  guest,
  session,
  onLogout,
  isLoggingOut,
  prefersReducedMotion,
}: Readonly<{
  guest: boolean;
  session: ReturnType<typeof useAuthSession>["session"];
  onLogout: () => void;
  isLoggingOut: boolean;
  prefersReducedMotion: boolean | null;
}>) {
  const vm = useRunsListViewModel({ guest });
  const reduced = prefersReducedMotion ?? false;

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
        onLogout={onLogout}
        isLoggingOut={isLoggingOut}
      />

      {guest && <GuestBanner />}

      <div id="main-content" className="dash-page-content">
        <RunsPageHeader vm={vm} reduced={reduced} />
        {guest ? <GuestGate reduced={reduced} /> : <RunsSection vm={vm} reduced={reduced} />}
      </div>
    </main>
  );
}

function GuestBanner() {
  return <div className="guest-banner" role="alert"><p className="guest-banner-text">You are viewing ALPHACI in preview mode. Sign up to see your pipeline runs.</p><div className="guest-banner-actions"><Link className="primary-button" href="/signup" style={{ padding: "0.4rem 1rem", fontSize: "0.82rem" }}>Sign up free</Link><Link className="ghost-button" href="/login" style={{ padding: "0.4rem 0.9rem", fontSize: "0.82rem" }}>Log in</Link></div></div>;
}

function RunsPageHeader({ vm, reduced }: Readonly<{ vm: RunsListViewModel; reduced: boolean }>) {
  return <motion.div className="workflow-page-header workflow-page-header--compact" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: EASE_OUT }}>
    <div className="workflow-page-header-left runs-page-header-left">
      <p className="workflow-page-breadcrumb"><span style={{ opacity: 0.55 }}>ALPHACI</span><span className="workflow-page-breadcrumb-sep">/</span><span>Workflows</span></p>
      <div className="workflow-page-title-row"><h1 className="workflow-page-title">{vm.repoFullName ? `Commits for ${vm.visibleRepoName}` : "All Workflow Commits"}</h1><div className="workflow-page-studio-badge"><span className="workflow-studio-led" aria-hidden="true" />Live results</div></div>
      {vm.repoFullName && <Link href="/runs" style={{ fontSize: "0.78rem", color: "var(--text-muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.25rem", marginTop: "0.3rem" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>All repos</Link>}
    </div>
  </motion.div>;
}

function GuestGate({ reduced }: Readonly<{ reduced: boolean }>) {
  return <motion.div custom={2} variants={sectionVariants} initial={reduced ? false : "hidden"} animate="visible"><div className="glass-panel" style={{ textAlign: "center", padding: "3rem 1.5rem" }}><p style={{ color: "var(--text-secondary)", marginBottom: "1.25rem", fontSize: "0.9rem" }}>Sign in to see your pipeline run history.</p><Link className="primary-button" href="/login?next=/runs" style={{ padding: "0.65rem 1.5rem", fontSize: "0.9rem" }}>Sign in</Link></div></motion.div>;
}

function FadeState({ stateKey, children, className }: Readonly<{ stateKey: string; children: React.ReactNode; className?: string }>) {
  return <motion.div key={stateKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className={className}>{children}</motion.div>;
}

function RunsSection({ vm, reduced }: Readonly<{ vm: RunsListViewModel; reduced: boolean }>) {
  return <motion.section aria-label="Pipeline run list" aria-live="polite" custom={2} variants={sectionVariants} initial={reduced ? false : "hidden"} animate="visible"><AnimatePresence mode="wait"><RunsState vm={vm} reduced={reduced} /></AnimatePresence></motion.section>;
}

function RunsState({ vm, reduced }: Readonly<{ vm: RunsListViewModel; reduced: boolean }>) {
  if (vm.status === "loading") return <FadeState stateKey="skeleton"><RunsSkeleton /></FadeState>;
  if (vm.error) return <FadeState stateKey="error"><RunsErrorState message={vm.error} onRetry={vm.reload} /></FadeState>;
  if (vm.runs.length === 0) return <FadeState stateKey="empty"><RunsEmptyState /></FadeState>;
  return <FadeState stateKey="list" className="runs-list-stack"><RunsSummaryStrip summary={vm.summary} repoFullName={vm.repoFullName} /><RunsToolbar vm={vm} />{vm.grouped.map((group) => <ProjectGroupSection key={group.repoFullName} group={group} reduced={reduced} collapsed={vm.isCollapsed(group.repoFullName)} onToggle={() => vm.toggleRepo(group.repoFullName)} />)}</FadeState>;
}

function RunsToolbar({ vm }: Readonly<{ vm: RunsListViewModel }>) {
  return <div className="runs-list-toolbar"><div><span>Commit history</span><strong>{vm.repoFullName ?? "All connected repositories"}</strong></div><p>{vm.runs.length} {vm.runs.length === 1 ? "commit" : "commits"} in {vm.grouped.length} {vm.grouped.length === 1 ? "project" : "projects"}</p></div>;
}
