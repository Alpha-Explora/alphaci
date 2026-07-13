"use client";

import Link from "next/link";
import { useState } from "react";

import { getSystemDeliveryProjects } from "@/lib/api/client";
import type {
  DeliveryProject,
  HierarchySystem,
} from "@/lib/api/hierarchy-contracts";
import { useApiResource } from "@/hooks/use-hierarchy";
import { LifecycleStatusBadge } from "./badges";
import { CreateDeliveryProjectDialog } from "./create-delivery-project-dialog";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        transition: "transform 0.18s ease",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        color: "var(--text-muted)",
      }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function DeliveryProjectChildren({
  groupId,
  systemId,
  extraProjects,
}: {
  groupId: string;
  systemId: string;
  extraProjects: DeliveryProject[];
}) {
  const { data, state, reload } = useApiResource<DeliveryProject[]>(
    () => getSystemDeliveryProjects(systemId),
    [systemId],
  );

  if (state === "loading") {
    return <div className="hier-tree-empty">Loading delivery projects…</div>;
  }
  if (state === "forbidden" || state === "notfound" || state === "error") {
    return (
      <div className="hier-tree-empty">
        Delivery projects unavailable.{" "}
        <button
          type="button"
          className="hier-activity-link"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          onClick={reload}
        >
          Retry
        </button>
      </div>
    );
  }

  // Merge freshly-created delivery projects (optimistic) with the fetched list.
  const fetched = data ?? [];
  const seen = new Set(fetched.map((project) => project.id));
  const merged = [
    ...extraProjects.filter((project) => !seen.has(project.id)),
    ...fetched,
  ];

  if (merged.length === 0) {
    return <div className="hier-tree-empty">No delivery projects yet.</div>;
  }

  return (
    <div className="hier-tree-children">
      {merged.map((project) => (
        <Link
          key={project.id}
          href={`/groups/${groupId}/delivery-projects/${project.id}`}
          className="hier-tree-leaf"
        >
          <span className="hier-tree-leaf-name">{project.name}</span>
          <span className="hier-count-chip">
            {project.repositoryCount}{" "}
            {project.repositoryCount === 1 ? "repo" : "repos"}
          </span>
          <LifecycleStatusBadge status={project.status} />
        </Link>
      ))}
    </div>
  );
}

function SystemNode({
  groupId,
  system,
  canManage,
}: {
  groupId: string;
  system: HierarchySystem;
  canManage: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [created, setCreated] = useState<DeliveryProject[]>([]);

  return (
    <div className="hier-tree-node">
      <div className="hier-tree-head">
        <button
          type="button"
          className="hier-btn-sm"
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${system.name}` : `Expand ${system.name}`}
          onClick={() => setExpanded((value) => !value)}
          style={{ padding: "0.3rem 0.45rem", minHeight: "auto" }}
        >
          <ChevronIcon open={expanded} />
        </button>
        <div className="hier-tree-head-main">
          <strong style={{ fontSize: "0.95rem", color: "var(--text-primary)" }}>
            {system.name}
          </strong>
          {system.description && (
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              {system.description}
            </span>
          )}
        </div>
        <span className="hier-count-chip">
          {system.deliveryProjectCount + created.length}{" "}
          {system.deliveryProjectCount + created.length === 1
            ? "project"
            : "projects"}
        </span>
        <LifecycleStatusBadge status={system.status} />
        {canManage && (
          <button
            type="button"
            className="hier-btn-sm"
            onClick={() => setDialogOpen(true)}
          >
            Add delivery project
          </button>
        )}
      </div>

      {expanded && (
        <DeliveryProjectChildren
          groupId={groupId}
          systemId={system.id}
          extraProjects={created}
        />
      )}

      {canManage && (
        <CreateDeliveryProjectDialog
          open={dialogOpen}
          systemId={system.id}
          onClose={() => setDialogOpen(false)}
          onCreated={(project) => {
            setCreated((current) => [project, ...current]);
            setExpanded(true);
          }}
        />
      )}
    </div>
  );
}

export function SystemTree({
  groupId,
  systems,
  canManage,
}: {
  groupId: string;
  systems: HierarchySystem[];
  canManage: boolean;
}) {
  return (
    <div>
      {systems.map((system) => (
        <SystemNode
          key={system.id}
          groupId={groupId}
          system={system}
          canManage={canManage}
        />
      ))}
    </div>
  );
}
