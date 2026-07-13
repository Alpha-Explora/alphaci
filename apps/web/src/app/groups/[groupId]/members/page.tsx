"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { getGroup, getGroupInvitations, getGroupMembers } from "@/lib/api/client";
import type {
  GroupInvitation,
  GroupMember,
  GroupSummary,
} from "@/lib/api/hierarchy-contracts";
import { isGroupManagerRole } from "@/lib/api/hierarchy-contracts";
import type { AuthMeResponse } from "@/lib/api/contracts";
import { useApiResource } from "@/hooks/use-hierarchy";
import { InviteMemberDialog } from "@/components/hierarchy/invite-member-dialog";
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
  const [inviteOpen, setInviteOpen] = useState(false);

  const membersResource = useApiResource<GroupMember[]>(
    () => getGroupMembers(group.id),
    [group.id],
  );
  // Invitations are owner/admin-only (plan §2.4) — don't fetch as a developer
  // (it would 403); the roster still renders for everyone.
  const invitationsResource = useApiResource<GroupInvitation[]>(
    () => getGroupInvitations(group.id),
    [group.id],
    { enabled: canManage },
  );

  const members = membersResource.data ?? [];
  const invitations = invitationsResource.data ?? [];

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Projects", href: "/groups" },
          { label: group.name, href: `/groups/${group.id}` },
          { label: "Members" },
        ]}
      />
      <PageHeader
        title="Members & invitations"
        subtitle={
          canManage
            ? "Add and remove members and manage invitations. Roles are managed in the Admin Console. Removing a member automatically reviews their repository access."
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
          invitations={invitations}
          canManage={canManage}
          currentUserId={currentUserId}
          onMembersChange={(updater) =>
            membersResource.setData((current) => updater(current ?? []))
          }
          onInvitationsChange={(updater) =>
            invitationsResource.setData((current) => updater(current ?? []))
          }
          inviteAction={
            canManage ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => setInviteOpen(true)}
              >
                Invite member
              </button>
            ) : undefined
          }
        />
      )}

      {canManage && (
        <InviteMemberDialog
          open={inviteOpen}
          groupId={group.id}
          onClose={() => setInviteOpen(false)}
          onInvited={(invitation) =>
            invitationsResource.setData((current) => [
              invitation,
              ...(current ?? []),
            ])
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
        <Breadcrumb items={[{ label: "Projects", href: "/groups" }, { label: "Members" }]} />
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
