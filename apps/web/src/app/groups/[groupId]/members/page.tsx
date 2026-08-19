"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { getGroup, getGroupMembers } from "@/lib/api/client";
import type {
  GroupMember,
  GroupSummary,
} from "@/lib/api/hierarchy-contracts";
import { isGroupManagerRole } from "@/lib/api/hierarchy-contracts";
import type { AuthMeResponse } from "@/lib/api/contracts";
import { useApiResource } from "@/hooks/use-hierarchy";
import { AddMemberDialog } from "@/components/hierarchy/add-member-dialog";
import { MemberTable } from "@/components/hierarchy/member-table";
import {
  Breadcrumb,
  GroupSubNav,
  HierarchyPageShell,
  LoadingRows,
  PageHeader,
  ResourceBoundary,
} from "@/components/hierarchy/primitives";

function MembersInner({
  group,
  currentUserId,
}: {
  group: GroupSummary;
  currentUserId: string;
}) {
  const canManage = isGroupManagerRole(group.role);
  const [addOpen, setAddOpen] = useState(false);

  const membersResource = useApiResource<GroupMember[]>(
    () => getGroupMembers(group.id),
    [group.id],
  );
  const members = membersResource.data ?? [];

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Projects", href: "/workflows" },
          { label: group.name, href: `/groups/${group.id}` },
          { label: "Members" },
        ]}
      />
      <PageHeader
        title="Members"
        subtitle={
          canManage
            ? "Add and remove members. Someone you add is a member immediately. Roles are managed in the Admin Console, and removing a member automatically reviews their repository access."
            : "People who belong to this group."
        }
      />
      <GroupSubNav groupId={group.id} active="members" />

      {membersResource.state === "loading" ? (
        <LoadingRows rows={4} />
      ) : membersResource.state === "error" ||
        membersResource.state === "forbidden" ||
        membersResource.state === "notfound" ? (
        <ResourceBoundary
          state={membersResource.state}
          onRetry={membersResource.reload}
        />
      ) : (
        <MemberTable
          groupId={group.id}
          members={members}
          canManage={canManage}
          currentUserId={currentUserId}
          onMembersChange={(updater) =>
            membersResource.setData((current) => updater(current ?? []))
          }
          addAction={
            canManage ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => setAddOpen(true)}
              >
                Add member
              </button>
            ) : undefined
          }
        />
      )}

      {canManage && (
        <AddMemberDialog
          open={addOpen}
          groupId={group.id}
          onClose={() => setAddOpen(false)}
          onAdded={(member) =>
            membersResource.setData((current) => [member, ...(current ?? [])])
          }
        />
      )}
    </>
  );
}

function MembersView({ session }: { session: AuthMeResponse }) {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const { data, state, reload } = useApiResource<GroupSummary>(
    () => getGroup(groupId),
    [groupId],
  );

  if (state !== "ready" || !data) {
    return (
      <>
        <Breadcrumb items={[{ label: "Projects", href: "/workflows" }, { label: "Members" }]} />
        <ResourceBoundary
          state={state}
          onRetry={reload}
          notFoundTitle="Group not found"
          notFoundMessage="This group doesn't exist, or you're not a member of it."
        />
      </>
    );
  }

  return (
    <MembersInner group={data} currentUserId={session.user.id} />
  );
}

export default function GroupMembersPage() {
  return (
    <HierarchyPageShell>
      {(session) => <MembersView session={session} />}
    </HierarchyPageShell>
  );
}
