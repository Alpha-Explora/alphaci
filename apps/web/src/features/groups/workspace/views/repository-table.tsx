"use client";

import Link from "next/link";

import type { HierarchyRepository } from "@/features/groups";
import { RepositoryStatusBadge } from "./badges";

/**
 * Repository list under a delivery project. The list the caller receives is
 * already scoped server-side (plan §2.6): managers see all; developers/viewers
 * see only repositories where they hold an active assignment.
 */
export function RepositoryTable({
  groupId,
  repositories,
}: {
  groupId: string;
  repositories: HierarchyRepository[];
}) {
  return (
    <div className="hier-panel">
      {repositories.map((repository) => (
        <Link
          key={repository.id}
          href={`/groups/${groupId}/repositories/${repository.id}`}
          className="hier-row"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div className="hier-row-identity">
            <span className="hier-avatar" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
            </span>
            <div className="hier-row-name">
              <strong>{repository.name}</strong>
              <span>
                {repository.repoFullName ?? "GitHub repository"}
              </span>
            </div>
          </div>
          <div className="hier-row-actions">
            <span className="hier-count-chip">
              {repository.assignmentCount}{" "}
              {repository.assignmentCount === 1
                ? "assigned member"
                : "assigned members"}
            </span>
            <RepositoryStatusBadge status={repository.status} />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--text-muted)" }}>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </Link>
      ))}
    </div>
  );
}
