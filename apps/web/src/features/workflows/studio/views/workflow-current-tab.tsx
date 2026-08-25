"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { getGroups } from "@/features/groups";
import type { GroupSummary } from "@/features/groups";
import type {
  CreateProjectResult,
  ProvisionedProject,
} from "@/shared/api/contracts";
import { WorkflowStageList } from "@/features/projects/detail";
import { DeploymentProvisioningSummary } from "./setup-result-panel";
import { FlowExplainer } from "@/features/guide/overview";
import { GroupWorkspacePanel } from "@/features/teams/detail";

interface WorkflowCurrentTabProps {
  latestResult: CreateProjectResult | null;
  loadingProjects: boolean;
  onOpenSetup: () => void;
  renderGroupCreate: (groupId: string, onComplete: () => void) => React.ReactNode;
  projects: ProvisionedProject[];
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 280, damping: 22 },
  },
};

const GROUP_LIST_PAGE_SIZE = 8;

/** One team. Every entry has a group now that the ungrouped bucket is gone. */
interface GroupListEntry {
  key: string;
  name: string;
  description: string | null;
  projects: ProvisionedProject[];
  groupId: string;
  group: GroupSummary;
}

/**
 * Current Projects — team-centric split pane. The left rail lists the user's
 * TEAMS; the right pane lists the selected team's repositories. Creating a
 * system in a team provisions its repository, so each repo here is a system of
 * the team. The per-project detail tabs live on the full page (/projects/[id])
 * via ProjectDetailTabs — "Open full page" is the way into them.
 *
 * There is no individual/personal side any more. A workspace IS a team and
 * every project belongs to one, so the old Repositories/Teams toggle addressed
 * a bucket that could never fill — it advertised a capability and then reported
 * that the reader had none of it.
 */
export function WorkflowCurrentTab({
  latestResult,
  loadingProjects,
  onOpenSetup,
  renderGroupCreate,
  projects,
}: Readonly<WorkflowCurrentTabProps>) {
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [groupListQuery, setGroupListQuery] = useState("");
  const [groupListPage, setGroupListPage] = useState(1);

  useEffect(() => {
    let active = true;
    void getGroups()
      .then((items) => {
        if (active) {
          setGroups(items);
          setGroupsError(null);
        }
      })
      .catch(() => {
        if (active) {
          // Hierarchy may be disabled or unreachable — degrade to the
          // ungrouped bucket so existing projects stay accessible.
          setGroups([]);
          setGroupsError("Could not load groups.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const entries: GroupListEntry[] = useMemo(() => {
    const groupList = groups ?? [];
    const list: GroupListEntry[] = groupList.map((group) => ({
      key: group.id,
      name: group.name,
      description: group.description,
      projects: projects.filter((project) => project.workspaceId === group.id),
      groupId: group.id,
      group,
    }));
    return list;
  }, [groups, projects]);

  const filteredEntries = useMemo(() => {
    const query = groupListQuery.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) =>
      entry.name.toLowerCase().includes(query),
    );
  }, [entries, groupListQuery]);

  // No query→page reset effect needed: currentGroupListPage below clamps the
  // page into the filtered range, so a narrowing search can't strand the user
  // on an out-of-range page.
  const groupListPageCount = Math.max(
    1,
    Math.ceil(filteredEntries.length / GROUP_LIST_PAGE_SIZE),
  );
  const currentGroupListPage = Math.min(groupListPage, groupListPageCount);
  const pagedEntries = useMemo(() => {
    const start = (currentGroupListPage - 1) * GROUP_LIST_PAGE_SIZE;
    return filteredEntries.slice(start, start + GROUP_LIST_PAGE_SIZE);
  }, [filteredEntries, currentGroupListPage]);

  const selectedEntry =
    entries.find((entry) => entry.key === selectedKey) ?? entries[0] ?? null;

  function handleGroupDeleted(groupId: string) {
    setGroups((current) =>
      current ? current.filter((group) => group.id !== groupId) : current,
    );
    setSelectedKey((current) => (current === groupId ? null : current));
  }


  const loading = loadingProjects || groups === null;


  return (
    <motion.section
      className="tab-content-panel"
      id="workflow-panel-current"
      role="tabpanel"
      aria-labelledby="workflow-tab-current"
      tabIndex={0}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: "transparent",
        border: "none",
        boxShadow: "none",
        padding: 0,
      }}
    >
      {/* ── Latest result banner ──────────────────────────────────── */}
      {latestResult ? (
        <div className="latest-result-banner glass-panel">
          <div className="latest-result-banner__header">
            <span className="latest-result-banner__dot" aria-hidden="true" />
            <p className="eyebrow latest-result-banner__eyebrow">
              Project Created Successfully
            </p>
            <span className="latest-result-banner__sep" aria-hidden="true">
              ·
            </span>
            <span className="latest-result-banner__repo">
              {latestResult.repoFullName}
            </span>
          </div>

          <div className="result-branches latest-result-banner__chips">
            <span className="branch-chip">{latestResult.status}</span>
            <span className="branch-chip">{latestResult.projectTypeId}</span>
            <span className="branch-chip">{latestResult.workflowRecipeId}</span>
            {latestResult.branchesCreated.map((branch) => (
              <span key={branch} className="branch-chip branch-chip--mono">
                {branch}
              </span>
            ))}
          </div>

          <p className="latest-result-banner__meta">
            Workflow file:{" "}
            <strong className="latest-result-banner__filename">
              {latestResult.outputFileName}
            </strong>
            {latestResult.githubCommitUrl ? (
              <a
                href={latestResult.githubCommitUrl}
                target="_blank"
                rel="noreferrer"
                className="latest-result-banner__commit-link"
              >
                commit:{" "}
                <span className="latest-result-banner__sha">
                  {latestResult.githubCommitSha.slice(0, 10)}
                </span>
              </a>
            ) : (
              <code className="latest-result-banner__sha-plain">
                {latestResult.githubCommitSha.slice(0, 10)}
              </code>
            )}
          </p>

          <WorkflowStageList files={latestResult.workflowFiles} />
          <DeploymentProvisioningSummary
            result={latestResult.deploymentProvisioning}
          />

          <div className="latest-result-banner__actions">
            <a
              className="latest-result-banner__action-btn latest-result-banner__action-btn--primary"
              href={latestResult.repoUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Repository
            </a>
            <a
              className="latest-result-banner__action-btn"
              href={`${latestResult.repoUrl}/actions`}
              target="_blank"
              rel="noreferrer"
            >
              Open Actions
            </a>
            <a
              className="latest-result-banner__action-btn"
              href={`${latestResult.repoUrl}/blob/main/${latestResult.workflowPath}`}
              target="_blank"
              rel="noreferrer"
            >
              View Workflow File
            </a>
          </div>

          <p className="latest-result-banner__footer">
            Workflow committed to{" "}
            <code className="file-path-label">{latestResult.workflowPath}</code>{" "}
            on <code className="file-path-label">main</code>. Push to{" "}
            <code className="file-path-label">test</code> to trigger your first
            CI run.
          </p>
        </div>
      ) : null}

      {/* ── Groups panel ─────────────────────────────────────────── */}
      {loading ? (
        <div className="repo-grid">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="skeleton-card glass-panel"
              style={{
                minHeight: "12rem",
                background: "rgba(17, 17, 22, 0.3)",
                animation: "state-pulse 1.5s infinite",
              }}
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: "2.5rem 1.5rem",
            textAlign: "center",
            background: "rgba(17, 17, 22, 0.3)",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
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
              No groups or projects yet.
            </p>
            <p
              style={{
                color: "var(--text-secondary)",
                margin: 0,
                fontSize: "0.85rem",
                maxWidth: "32rem",
              }}
            >
              Create a workspace from the picker in the header — a workspace is
              a team — then create a repository inside it. ALPHACI
              provisions the repository and commits a workflow that runs
              through the gated stages below on every change. Open the{" "}
              <Link href="/guide" className="inline-link">
                guide
              </Link>{" "}
              to see how it all fits together.
            </p>
          </div>
          <div
            style={{
              width: "100%",
              maxWidth: "32rem",
              padding: "1rem",
              borderRadius: "var(--radius-card)",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--border-soft)",
            }}
          >
            <FlowExplainer variant="compact" />
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              className="ghost-button"
              type="button"
              onClick={onOpenSetup}
              style={{
                padding: "0.6rem 1.4rem",
                fontSize: "0.88rem",
                minHeight: "2.5rem",
              }}
            >
              Create a project
            </button>
          </div>
        </div>
      ) : (
        <div className="project-workspace">
          <div className="project-list-rail">
            <aside
              className="project-list"
              aria-label="Teams"
              data-tour="projects-list"
            >
              <div className="project-list-body">
                <>
              <input
                className="project-list-search"
                aria-label="Search groups"
                type="search"
                placeholder="Search groups..."
                value={groupListQuery}
                onChange={(event) => setGroupListQuery(event.target.value)}
              />
              {groupsError ? (
                <p className="project-list-empty">{groupsError}</p>
              ) : null}
              {pagedEntries.length === 0 ? (
                <p className="project-list-empty">No groups match.</p>
              ) : (
                pagedEntries.map((entry) => {
                  const isSelected = selectedEntry?.key === entry.key;
                  return (
                    <button
                      key={entry.key}
                      className={`project-list-item${isSelected ? " selected" : ""}`}
                      data-project-id={entry.key}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedKey(entry.key)}
                    >
                      <span className="project-list-title">{entry.name}</span>
                      <span className="project-list-meta">
                        {entry.projects.length}{" "}
                        {entry.projects.length === 1
                          ? "repository"
                          : "repositories"}
                      </span>
                    </button>
                  );
                })
              )}
              {filteredEntries.length > 0 ? (
                <div className="project-list-pagination">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() =>
                      setGroupListPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentGroupListPage <= 1}
                  >
                    Prev
                  </button>
                  <span className="project-list-pagination-status">
                    Page {currentGroupListPage} of {groupListPageCount}
                  </span>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() =>
                      setGroupListPage((page) =>
                        Math.min(groupListPageCount, page + 1),
                      )
                    }
                    disabled={currentGroupListPage >= groupListPageCount}
                  >
                    Next
                  </button>
                </div>
              ) : null}
                </>
              </div>
            </aside>
          </div>
          <div className="project-detail-column">
            {selectedEntry ? (
              <motion.article
                key={selectedEntry.key}
                variants={cardVariants}
                initial="hidden"
                animate="show"
                className="project-detail-panel"
              >
                <div className="project-detail-header">
                  <div>
                    <h3>{selectedEntry.name}</h3>
                    <p>
                      {selectedEntry.description ??
                        (selectedEntry.group
                          ? "Projects owned by this group."
                          : "Projects not owned by any group.")}
                    </p>
                  </div>
                  <span className="project-detail-header-badges">
                    <span className="branch-chip">
                      {selectedEntry.projects.length}{" "}
                      {selectedEntry.projects.length === 1
                        ? "repository"
                        : "repositories"}
                    </span>
                  </span>
                </div>

                {/* Every entry is a team — `entries` is built from the group
                    list — so the panel is the only branch. The plain-list
                    fallback that used to sit here served the Ungrouped bucket,
                    which no longer exists. */}
                <GroupWorkspacePanel
                  group={selectedEntry.group}
                  projects={selectedEntry.projects}
                  renderCreateProject={(onComplete) => renderGroupCreate(selectedEntry.group.id, onComplete)}
                  onDeleted={handleGroupDeleted}
                />
              </motion.article>
            ) : null}
          </div>
        </div>
      )}
    </motion.section>
  );
}
