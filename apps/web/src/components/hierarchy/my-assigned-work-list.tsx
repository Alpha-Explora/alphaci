"use client";

import Link from "next/link";

import type { MyAssignedRepository } from "@/lib/api/hierarchy-contracts";
import { timeAgo } from "@/hooks/use-hierarchy";
import { AccessStatusBadge } from "./badges";

/**
 * Developer "My assigned work" list — read-only. Renders NO create / manage /
 * assign controls of any kind (plan §3.4 developer surface). Each row links to
 * the repository (where the developer can manage non-production configuration)
 * and, when a real GitHub repo is linked, out to GitHub / CI activity.
 */
export function MyAssignedWorkList({
  repositories,
}: {
  repositories: MyAssignedRepository[];
}) {
  return (
    <div className="hier-panel">
      {repositories.map((repository) => {
        const path = [repository.groupName, repository.systemName, repository.deliveryProjectName]
          .filter(Boolean)
          .join(" / ");
        return (
          <div key={repository.assignmentId} className="hier-row">
            <div className="hier-row-identity">
              <span className="hier-avatar" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                </svg>
              </span>
              <div className="hier-row-name">
                <strong>{repository.repositoryName}</strong>
                <span>{path || repository.repoFullName || "Assigned repository"}</span>
              </div>
            </div>
            <div className="hier-row-actions">
              <AccessStatusBadge status={repository.status} />
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                Updated {timeAgo(repository.updatedAt)}
              </span>
              {repository.groupId && (
                <Link
                  href={`/groups/${repository.groupId}/repositories/${repository.repositoryId}`}
                  className="hier-btn-sm"
                >
                  Open
                </Link>
              )}
              {repository.htmlUrl && (
                <a
                  href={repository.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hier-btn-sm"
                >
                  CI activity
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
