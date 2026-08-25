"use client";



import { AddMemberDialog, HierarchyPageShell, MemberTable } from "@/features/groups/workspace";
import {
  Breadcrumb,
  GroupSubNav,
  LoadingRows,
  PageHeader,
  ResourceBoundary,
} from "@/features/groups/workspace";
import type { AuthMeResponse, GroupSummary } from "../../model/groups-types";
import { useGroupRouteViewModel, useGroupViewModel } from "@/features/groups";
import { useGroupMembersViewModel } from "../view-models/use-group-members-view-model";

function MembersInner({
  group,
  currentUserId,
}: Readonly<{ group: GroupSummary; currentUserId: string }>) {
  const vm = useGroupMembersViewModel(group);

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
          vm.canManage
            ? "Add and remove members. Someone you add is a member immediately. Roles are managed in the Admin Console, and removing a member automatically reviews their repository access."
            : "People who belong to this group."
        }
      />
      <GroupSubNav groupId={group.id} active="members" />

      {vm.status === "loading" ? (
        <LoadingRows rows={4} />
      ) : vm.status === "error" ||
        vm.status === "forbidden" ||
        vm.status === "notfound" ? (
        <ResourceBoundary state={vm.status} onRetry={vm.reload} />
      ) : (
        <MemberTable
          groupId={group.id}
          members={vm.members}
          canManage={vm.canManage}
          currentUserId={currentUserId}
          onMembersChange={vm.applyMembers}
          addAction={
            vm.canManage ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => vm.setAddOpen(true)}
              >
                Add member
              </button>
            ) : undefined
          }
        />
      )}

      {vm.canManage && (
        <AddMemberDialog
          open={vm.addOpen}
          groupId={group.id}
          onClose={() => vm.setAddOpen(false)}
          onAdded={vm.prependMember}
        />
      )}
    </>
  );
}

function MembersResolver({ session }: Readonly<{ session: AuthMeResponse }>) {
  const { groupId } = useGroupRouteViewModel();
  const vm = useGroupViewModel(groupId);

  if (vm.status !== "ready" || !vm.group) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Projects", href: "/workflows" },
            { label: "Members" },
          ]}
        />
        <ResourceBoundary
          state={vm.status}
          onRetry={vm.reload}
          notFoundTitle="Group not found"
          notFoundMessage="This group doesn't exist, or you're not a member of it."
        />
      </>
    );
  }

  return <MembersInner group={vm.group} currentUserId={session.user.id} />;
}

/** Public view for the group members route. */
export function GroupMembersView() {
  return (
    <HierarchyPageShell>
      {(session) => <MembersResolver session={session} />}
    </HierarchyPageShell>
  );
}
