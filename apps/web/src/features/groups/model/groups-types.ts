/* Domain types for the groups hierarchy.
 *
 * The wire shapes still live in lib/api/hierarchy-contracts, shared with the
 * unmigrated verticals; re-exporting through this file gives the slice one type
 * surface, so when those contracts are decomposed per-domain only this file
 * changes rather than every view. */
export type {
  AddGroupMemberRequest,
  DeliveryProject,
  GroupActivityItem,
  GroupActivityQuery,
  GroupActivityResponse,
  GroupMember,
  GroupRole,
  GroupSummary,
  HierarchyRepository,
  HierarchySystem,
  InternalUserDirectoryEntry,
  RepositoryAccessStatus,
  RepositoryAccessStatusResponse,
  RepositoryAssignment,
  UpdateGroupRequest,
} from "@/features/groups/data/hierarchy-contracts";
export type { AuthMeResponse, ProvisionedProject } from "@/shared/api/contracts";
