"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AppNav } from "@/components/layout/app-nav";
import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLoader } from "@/components/layout/pipeline-loader";
import {
  WorkspaceProvider,
  useWorkspaceSelection,
} from "@/components/layout/workspace-context";
import { CreateGroupDialog } from "@/components/hierarchy/create-group-dialog";
import { GroupWorkspacePanel } from "@/components/product/group-workspace-panel";
import { useAuthSession } from "@/hooks/use-auth-session";
import { getProjects, getWorkspaceTeams, logout } from "@/lib/api/client";
import type { ProvisionedProject } from "@/lib/api/contracts";
import {
  isGlobalCreatorRole,
  type GroupSummary,
} from "@/lib/api/hierarchy-contracts";
import { isGuest } from "@/lib/auth/subscription";

const PAGE_SIZE = 8;
const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

/**
 * Teams — the group surface, promoted out of the Projects tab's rail toggle.
 *
 * The same groups are still reachable from Projects → Current Projects → Teams;
 * this page exists because that toggle is three levels deep and effectively
 * undiscoverable. Deliberately does NOT repoint the Projects nav item (an
 * earlier attempt to do that was reverted) — Projects still owns repositories,
 * Teams owns groups.
 */
function TeamsPageContent() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const { status, session, error: sessionError, refresh } = useAuthSession();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [projects, setProjects] = useState<ProvisionedProject[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const { selectedWorkspaceId, selectedWorkspace } = useWorkspaceSelection();

  const guest = isGuest(session);
  // Creating a team needs the global tier AND manager rights on this
  // workspace — the backend enforces both; this only decides whether to
  // offer the button.
  const canCreateGroup =
    isGlobalCreatorRole(session?.appRole) &&
    Boolean(selectedWorkspaceId) &&
    (selectedWorkspace?.role === "admin" ||
      selectedWorkspace?.role === "delegated_lead");

  useEffect(() => {
    if (status === "signed-out") router.replace("/login?next=/teams");
  }, [router, status]);

  function loadGroups() {
    if (!selectedWorkspaceId) {
      setGroups([]);
      return;
    }
    void getWorkspaceTeams(selectedWorkspaceId)
      .then((items) => {
        setGroups(items);
        setLoadError(null);
      })
      .catch(() => {
        // Hierarchy may be unreachable — show an empty list with an error
        // rather than a spinner that never resolves.
        setGroups([]);
        setLoadError("Could not load teams.");
      });
  }

  useEffect(() => {
    if (status !== "signed-in" || guest) return;
    loadGroups();
    void getProjects(100)
      .then((response) => setProjects(response.items))
      .catch(() => setProjects([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, guest, selectedWorkspaceId]);

  const entries = useMemo(
    () =>
      (groups ?? []).map((group) => ({
        group,
        projects: projects.filter(
          (project) => project.workspaceId === group.id,
        ),
      })),
    [groups, projects],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) =>
      entry.group.name.toLowerCase().includes(needle),
    );
  }, [entries, query]);

  // Clamp rather than reset-on-change: a narrowing search must not strand the
  // user on an out-of-range page, and the effect-based reset trips
  // react-hooks/set-state-in-effect.
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  const selected =
    entries.find((entry) => entry.group.id === selectedId) ?? entries[0] ?? null;

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      await refresh();
      router.push("/");
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (status === "loading") return <PipelineLoader label="Loading teams" />;

  if (status === "error") {
    return (
      <main className="dash-shell">
        <FlowBackground />
        <div className="state-body">
          <div className="state-card">
            <h1>Session verification failed</h1>
            <p>We could not verify your session. Please retry or sign in again.</p>
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
              <Link className="ghost-button" href="/login?next=/teams">
                Go to login
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (status === "signed-out") return null;

  const loading = groups === null;

  return (
    <main className="dash-shell" suppressHydrationWarning>
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
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE_OUT }}
        >
          <div className="workflow-page-header-left">
            <p className="workflow-page-breadcrumb">
              <span style={{ opacity: 0.55 }}>ALPHACI</span>
              <span className="workflow-page-breadcrumb-sep">/</span>
              <span>Teams</span>
            </p>
            <div className="workflow-page-title-row">
              <h1 className="workflow-page-title">Teams</h1>
              <div className="workflow-page-studio-badge">
                <span className="workflow-studio-led" aria-hidden="true" />
                {entries.length} {entries.length === 1 ? "team" : "teams"}
                {selectedWorkspace ? ` in ${selectedWorkspace.name}` : ""}
              </div>
            </div>
            <p
              style={{
                margin: "0.4rem 0 0",
                color: "var(--text-secondary)",
                fontSize: "0.86rem",
              }}
            >
              Teams live inside the workspace selected in the header. Each owns its
              own members and repositories.
            </p>
          </div>
        </motion.div>

        {loadError ? (
          <p className="error-text" style={{ marginTop: 0 }}>
            {loadError}
          </p>
        ) : null}

        {loading ? (
          <div className="repo-grid">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="skeleton-card glass-panel"
                style={{ minHeight: "12rem", animation: "state-pulse 1.5s infinite" }}
              />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div
            className="glass-panel"
            style={{
              padding: "2.5rem 1.5rem",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              alignItems: "center",
            }}
          >
            <div>
              <p
                style={{
                  color: "var(--text-primary)",
                  margin: "0 0 0.5rem",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                }}
              >
                No teams yet.
              </p>
              <p
                style={{
                  color: "var(--text-secondary)",
                  margin: 0,
                  fontSize: "0.85rem",
                  maxWidth: "34rem",
                }}
              >
                {canCreateGroup
                  ? "Create a team to group repositories and add developers to them."
                  : "No teams in this workspace yet. Only a team lead of this workspace can create one."}
              </p>
            </div>
            {canCreateGroup ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => setCreateOpen(true)}
                style={{ padding: "0.6rem 1.4rem", fontSize: "0.88rem" }}
              >
                Create a team
              </button>
            ) : null}
          </div>
        ) : (
          <div className="project-workspace">
            <div className="project-list-rail">
              <aside className="project-list" aria-label="Teams">
                <div className="project-list-body">
                  <input
                    className="project-list-search"
                    aria-label="Search teams"
                    type="search"
                    placeholder="Search teams..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {canCreateGroup ? (
                    <button
                      type="button"
                      className="primary-button project-list-create"
                      onClick={() => setCreateOpen(true)}
                    >
                      + New team
                    </button>
                  ) : null}

                  {paged.length === 0 ? (
                    <p className="project-list-empty">No teams match your search.</p>
                  ) : (
                    paged.map((entry) => {
                      const isSelected = selected?.group.id === entry.group.id;
                      return (
                        <button
                          key={entry.group.id}
                          type="button"
                          className={`project-list-item${isSelected ? " selected" : ""}`}
                          aria-pressed={isSelected}
                          onClick={() => setSelectedId(entry.group.id)}
                        >
                          <span className="project-list-title">
                            {entry.group.name}
                          </span>
                          <span className="project-list-meta">
                            {entry.group.memberCount}{" "}
                            {entry.group.memberCount === 1 ? "member" : "members"}
                            {" · "}
                            {entry.projects.length}{" "}
                            {entry.projects.length === 1 ? "repo" : "repos"}
                          </span>
                        </button>
                      );
                    })
                  )}

                  {filtered.length > PAGE_SIZE ? (
                    <div className="project-list-pagination">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                      >
                        Prev
                      </button>
                      <span className="project-list-pagination-status">
                        Page {currentPage} of {pageCount}
                      </span>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                        disabled={currentPage >= pageCount}
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </div>
              </aside>
            </div>

            <div className="project-detail-column">
              {selected ? (
                <motion.article
                  key={selected.group.id}
                  className="project-detail-panel"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, ease: EASE_OUT }}
                >
                  <div className="project-detail-header">
                    <div>
                      <h3>{selected.group.name}</h3>
                      <p>
                        {selected.group.description ??
                          "Members, activity, and the repositories this team owns."}
                      </p>
                    </div>
                    <span className="project-detail-header-badges">
                      <span className="branch-chip">
                        {selected.projects.length}{" "}
                        {selected.projects.length === 1
                          ? "repository"
                          : "repositories"}
                      </span>
                    </span>
                  </div>

                  <GroupWorkspacePanel
                    group={selected.group}
                    projects={selected.projects}
                    onDeleted={(groupId) => {
                      setGroups((current) =>
                        current
                          ? current.filter((group) => group.id !== groupId)
                          : current,
                      );
                      setSelectedId(null);
                    }}
                    // Creating a repository is the Projects surface's job — this
                    // page hands off rather than embedding the whole
                    // create-project form a second time.
                    renderCreateProject={() => (
                      <div className="env-empty-state">
                        <strong>Create a repository for this team</strong>
                        <p>
                          Repositories are created from the Projects surface, which
                          owns the full setup form.
                        </p>
                        <Link
                          className="primary-button"
                          href="/workflows?tab=setup"
                        >
                          Go to Create Project
                        </Link>
                      </div>
                    )}
                  />
                </motion.article>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {canCreateGroup ? (
        <CreateGroupDialog
          open={createOpen}
          parentWorkspaceId={selectedWorkspaceId ?? undefined}
          onClose={() => setCreateOpen(false)}
          onCreated={(group) => {
            setGroups((current) => [group, ...(current ?? [])]);
            setSelectedId(group.id);
            setQuery("");
            setPage(1);
          }}
        />
      ) : null}
    </main>
  );
}

export default function TeamsPage() {
  return (
    <WorkspaceProvider>
      <TeamsPageContent />
    </WorkspaceProvider>
  );
}
