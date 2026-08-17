"use client";

import Link from "next/link";

import type { GroupSummary } from "@/lib/api/hierarchy-contracts";
import { GroupStatusBadge, RoleBadge } from "./badges";

export function GroupCard({ group }: { group: GroupSummary }) {
  return (
    <Link href={`/groups/${group.id}`} className="hier-card">
      <div className="hier-card-top">
        <h3 className="hier-card-name">{group.name}</h3>
        <GroupStatusBadge status={group.status} />
      </div>
      {group.description ? (
        <p className="hier-card-desc">{group.description}</p>
      ) : (
        <p className="hier-card-desc" style={{ color: "var(--text-muted)" }}>
          {group.businessUnit ?? "No description"}
        </p>
      )}
      <div className="hier-card-meta">
        <span>
          <strong>{group.memberCount}</strong>{" "}
          {group.memberCount === 1 ? "member" : "members"}
        </span>
        <span>
          <strong>{group.systemCount}</strong>{" "}
          {group.systemCount === 1 ? "system" : "systems"}
        </span>
        <span style={{ marginLeft: "auto" }}>
          <RoleBadge role={group.role} />
        </span>
      </div>
    </Link>
  );
}
