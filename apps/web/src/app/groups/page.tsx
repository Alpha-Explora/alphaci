"use client";

import { useState } from "react";

import { getGroups } from "@/lib/api/client";
import type { GroupSummary } from "@/lib/api/hierarchy-contracts";
import { useApiResource } from "@/hooks/use-hierarchy";
import { CreateGroupDialog } from "@/components/hierarchy/create-group-dialog";
import { GroupCard } from "@/components/hierarchy/group-card";
import {
  HierarchyPageShell,
  PageHeader,
  ResourceBoundary,
} from "@/components/hierarchy/primitives";

function GroupsView() {
  const { data, state, reload, setData } = useApiResource<GroupSummary[]>(
    () => getGroups(),
    [],
    { emptyWhen: (groups) => groups.length === 0 },
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const groups = data ?? [];

  function handleCreated(group: GroupSummary) {
    setData((current) => [group, ...(current ?? [])]);
    reload();
  }

  return (
    <>
      <PageHeader
        title="Groups"
        subtitle="Groups you manage or belong to. Open a group to manage members, systems, delivery projects, repositories, and access."
        actions={
          <button
            type="button"
            className="primary-button"
            onClick={() => setDialogOpen(true)}
          >
            Create group
          </button>
        }
      />

      {state === "ready" ? (
        <div className="hier-card-grid">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      ) : (
        <ResourceBoundary
          state={state}
          onRetry={reload}
          emptyTitle="No groups yet"
          emptyMessage="Create your first group to start organizing systems, delivery projects, repositories, and access."
          emptyAction={
            <button
              type="button"
              className="primary-button"
              onClick={() => setDialogOpen(true)}
              style={{ marginTop: "0.4rem" }}
            >
              Create group
            </button>
          }
        />
      )}

      <CreateGroupDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}

export default function GroupsPage() {
  return <HierarchyPageShell>{() => <GroupsView />}</HierarchyPageShell>;
}
