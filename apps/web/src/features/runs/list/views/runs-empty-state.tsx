"use client";

import Link from "next/link";

export function RunsEmptyState() {
  return (
    <div className="runs-empty-state">
      <div className="runs-empty-icon">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>

      <div>
        <h2>No pipeline runs yet</h2>
        <p>
          Push a commit to a connected repository to see your pipeline results
          here. Each run shows exactly what passed, what failed, and how to fix
          it.
        </p>
      </div>

      <Link
        className="ghost-button"
        href="/workflows"
        style={{
          padding: "0.5rem 1.4rem",
          fontSize: "0.88rem",
          minHeight: "2.4rem",
        }}
      >
        Connect a repository
      </Link>
    </div>
  );
}
